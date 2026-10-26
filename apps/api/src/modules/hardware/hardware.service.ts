import type { QueryFilter } from 'mongoose';
import {
  MAX_PC_SPECS_PER_USER,
  type CompatCheckInput,
  type CompatibleGames,
  type CompatResult,
  type ComponentMatchQuery,
  type ComponentQuery,
  type ComponentType,
  type HardwareComponent as ComponentDto,
  type PcSpec as PcSpecDto,
  type PcSpecInput,
  type SpecHardwareInput,
} from '@tgh/shared';
import type { AuthContext } from '../../core/auth/context';
import { bus } from '../../core/events/bus';
import { firstTime } from '../../core/events/once';
import { AppError } from '../../core/http/errors';
import { escapeRegex } from '../../core/http/utils';
import { dayKey } from '../../core/time/periods';
import { Game, type GameDoc } from '../games/game.model';
import { GAME_SUMMARY_FIELDS, toGameDetail, toGameSummary } from '../games/games.mapper';
import { findGameBySlug } from '../games/games.service';
import { evaluate, type HardwareProfile } from './compatibility';
import { bestComponentMatch } from './component-match';
import { HardwareComponent, PcSpec, type ComponentDoc, type PcSpecDoc } from './hardware.model';

export function toComponent(doc: ComponentDoc): ComponentDto {
  return {
    id: String(doc._id),
    key: doc.key,
    type: doc.type,
    brand: doc.brand,
    model: doc.model,
    series: doc.series,
    segment: doc.segment,
    score: doc.score,
    vramGb: doc.vramGb ?? null,
    releaseYear: doc.releaseYear ?? null,
    priceTnd: doc.priceTnd
      ? { amount: doc.priceTnd.amount, source: doc.priceTnd.source, updatedAt: doc.priceTnd.updatedAt.toISOString() }
      : null,
  };
}

const componentLabel = (doc: ComponentDoc) => `${doc.brand} ${doc.model}`;

export async function searchComponents({ type, q, brand, segment, limit }: ComponentQuery): Promise<ComponentDto[]> {
  const filter: QueryFilter<ComponentDoc> = { type };
  if (brand) filter.brand = brand;
  if (segment) filter.segment = segment;
  if (q) {
    // Every word must match: "rtx 30" finds RTX 3060/3070/3080.
    filter.$and = q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => ({ searchText: { $regex: escapeRegex(term) } }));
  }
  const docs = await HardwareComponent.find(filter).sort({ score: -1 }).limit(limit).lean<ComponentDoc[]>();
  return docs.map(toComponent);
}

/** The index entry for a part name a computer reported, or null when we can't tell which one it is. */
export async function matchComponent({ type, name }: ComponentMatchQuery): Promise<ComponentDto | null> {
  const docs = await HardwareComponent.find({ type }).lean<ComponentDoc[]>();
  const match = bestComponentMatch(name, docs);
  return match ? toComponent(match) : null;
}

async function loadPair(cpuId: string, gpuId: string): Promise<{ cpu: ComponentDoc; gpu: ComponentDoc }> {
  const [cpu, gpu] = await Promise.all([
    HardwareComponent.findOne({ _id: cpuId, type: 'cpu' }).lean<ComponentDoc>(),
    HardwareComponent.findOne({ _id: gpuId, type: 'gpu' }).lean<ComponentDoc>(),
  ]);
  if (!cpu) throw AppError.unprocessable('Unknown processor', { fields: { cpuId: 'Pick a processor from the list' } });
  if (!gpu) throw AppError.unprocessable('Unknown graphics card', { fields: { gpuId: 'Pick a graphics card from the list' } });
  return { cpu, gpu };
}

/* ───────────── Saved rigs ───────────── */

async function toSpecDtos(specs: PcSpecDoc[]): Promise<PcSpecDto[]> {
  const ids = specs.flatMap((spec) => [spec.cpuId, spec.gpuId]);
  const components = await HardwareComponent.find({ _id: { $in: ids } }).lean<ComponentDoc[]>();
  const byId = new Map(components.map((doc) => [String(doc._id), toComponent(doc)]));
  return specs.flatMap((spec) => {
    const cpu = byId.get(String(spec.cpuId));
    const gpu = byId.get(String(spec.gpuId));
    if (!cpu || !gpu) return [];
    return [
      {
        id: String(spec._id),
        name: spec.name,
        cpu,
        gpu,
        ramGb: spec.ramGb,
        storageGb: spec.storageGb ?? null,
        os: spec.os,
        isPrimary: spec.isPrimary,
        createdAt: spec.createdAt.toISOString(),
      },
    ];
  });
}

export async function listSpecs(userId: string): Promise<PcSpecDto[]> {
  const specs = await PcSpec.find({ userId }).sort({ isPrimary: -1, createdAt: 1 }).lean<PcSpecDoc[]>();
  return toSpecDtos(specs);
}

async function ownedSpec(userId: string, specId: string): Promise<PcSpecDoc> {
  const spec = await PcSpec.findOne({ _id: specId, userId }).lean<PcSpecDoc>();
  if (!spec) throw AppError.notFound('Saved rig');
  return spec;
}

export async function createSpec(userId: string, input: PcSpecInput): Promise<PcSpecDto> {
  const count = await PcSpec.countDocuments({ userId });
  if (count >= MAX_PC_SPECS_PER_USER) {
    throw AppError.conflict(`You can save up to ${MAX_PC_SPECS_PER_USER} rigs — remove one first`);
  }
  await loadPair(input.cpuId, input.gpuId);

  const isPrimary = input.isPrimary || count === 0;
  if (isPrimary) await PcSpec.updateMany({ userId }, { $set: { isPrimary: false } });
  const spec = await PcSpec.create({ ...input, userId, isPrimary });

  bus.emit('pc.spec_saved', { userId, specId: String(spec._id) });
  const [dto] = await toSpecDtos([spec.toObject()]);
  return dto!;
}

export async function updateSpec(userId: string, specId: string, input: Partial<PcSpecInput>): Promise<PcSpecDto> {
  const current = await ownedSpec(userId, specId);
  if (input.cpuId || input.gpuId) {
    await loadPair(input.cpuId ?? String(current.cpuId), input.gpuId ?? String(current.gpuId));
  }
  if (input.isPrimary) await PcSpec.updateMany({ userId, _id: { $ne: specId } }, { $set: { isPrimary: false } });
  // Un-setting the only primary would leave none; ignore that request.
  const update = input.isPrimary === false && current.isPrimary ? { ...input, isPrimary: true } : input;

  const spec = await PcSpec.findOneAndUpdate({ _id: specId, userId }, { $set: update }, { returnDocument: 'after' }).lean<PcSpecDoc>();
  const [dto] = await toSpecDtos([spec!]);
  return dto!;
}

export async function deleteSpec(userId: string, specId: string): Promise<void> {
  const spec = await ownedSpec(userId, specId);
  await PcSpec.deleteOne({ _id: spec._id });
  if (spec.isPrimary) {
    const next = await PcSpec.findOne({ userId }).sort({ createdAt: 1 });
    if (next) await PcSpec.updateOne({ _id: next._id }, { $set: { isPrimary: true } });
  }
}

/* ───────────── Compatibility ───────────── */

interface ResolvedRig {
  profile: HardwareProfile;
  cpu: ComponentDoc;
  gpu: ComponentDoc;
}

async function resolveRig(
  auth: AuthContext | null,
  input: { specId?: string; spec?: SpecHardwareInput },
): Promise<ResolvedRig> {
  let hardware: SpecHardwareInput;
  if (input.specId) {
    if (!auth) throw AppError.unauthorized('Sign in to use a saved rig');
    const spec = await ownedSpec(auth.userId, input.specId);
    hardware = { cpuId: String(spec.cpuId), gpuId: String(spec.gpuId), ramGb: spec.ramGb, storageGb: spec.storageGb };
  } else {
    hardware = input.spec!;
  }

  const { cpu, gpu } = await loadPair(hardware.cpuId, hardware.gpuId);
  return {
    cpu,
    gpu,
    profile: {
      cpu: { label: componentLabel(cpu), score: cpu.score },
      gpu: { label: componentLabel(gpu), score: gpu.score, vramGb: gpu.vramGb },
      ramGb: hardware.ramGb,
      storageGb: hardware.storageGb ?? null,
    },
  };
}

/** Cheapest-tier parts that reach the target. Only desktop parts: laptop chips can't be bought as upgrades. */
async function upgradeOptions(type: ComponentType, minScore: number, currentId: string): Promise<ComponentDto[]> {
  const docs = await HardwareComponent.find({ type, segment: 'desktop', score: { $gte: minScore }, _id: { $ne: currentId } })
    .sort({ score: 1 })
    .limit(3)
    .lean<ComponentDoc[]>();
  return docs.map(toComponent);
}

export async function checkCompatibility(input: CompatCheckInput, auth: AuthContext | null): Promise<CompatResult> {
  const game = await findGameBySlug(input.gameSlug);
  const detail = toGameDetail(game);
  const rig = await resolveRig(auth, input);
  const evaluation = evaluate(rig.profile, detail.requirements);

  // Laptop processors and graphics are soldered to the board, so swapping them isn't advice we can give.
  const laptop = rig.cpu.segment === 'laptop' || rig.gpu.segment === 'laptop';
  const upgrades: CompatResult['upgrades'] = [];
  for (const dimension of evaluation.dimensions) {
    if (laptop) break;
    if (dimension.key !== 'cpu' && dimension.key !== 'gpu') continue;
    if (dimension.status !== 'below' && dimension.status !== 'minimum') continue;
    const recScore = detail.requirements.recommended?.[dimension.key === 'cpu' ? 'cpuScore' : 'gpuScore'] ?? null;
    const minScore = detail.requirements.minimum?.[dimension.key === 'cpu' ? 'cpuScore' : 'gpuScore'] ?? null;
    const target = recScore !== null ? 'recommended' : 'minimum';
    const score = recScore ?? minScore;
    if (score === null) continue;
    const current = dimension.key === 'cpu' ? rig.cpu : rig.gpu;
    const options = await upgradeOptions(dimension.key, score, String(current._id));
    if (options.length > 0) upgrades.push({ key: dimension.key, target, options });
  }

  const ram = evaluation.dimensions.find((d) => d.key === 'ram');
  const recRam = detail.requirements.recommended?.ramGb;
  const ramTargetGb = ram && (ram.status === 'below' || ram.status === 'minimum') && recRam && recRam > rig.profile.ramGb ? recRam : null;
  const ramAdvice = ramTargetGb ? `Going to ${ramTargetGb} GB matches the recommended spec.` : null;

  const short = evaluation.dimensions.some((d) => (d.key === 'cpu' || d.key === 'gpu') && (d.status === 'below' || d.status === 'minimum'));
  const upgradeNoteKind = laptop ? (short ? 'laptop' : null) : upgrades.some((u) => u.key === 'cpu') ? 'socket' : null;
  const upgradeNote =
    upgradeNoteKind === 'laptop'
      ? "This is a laptop: its processor and graphics can't be swapped. Memory, and sometimes storage, are the parts you can upgrade."
      : upgradeNoteKind === 'socket'
        ? 'Processor upgrades depend on your motherboard socket — check compatibility before buying.'
        : null;

  if (auth && (await firstTime(`compat:${auth.userId}:${detail.id}:${dayKey()}`))) {
    bus.emit('pc.compat_checked', { userId: auth.userId, gameId: detail.id });
  }

  return {
    game: toGameSummary(game),
    overall: evaluation.overall,
    confidence: evaluation.confidence,
    headline: evaluation.headline,
    detail: evaluation.detail,
    dimensions: evaluation.dimensions,
    bottleneck: evaluation.bottleneck,
    singleTier: evaluation.singleTier,
    upgrades,
    upgradeNote,
    upgradeNoteKind,
    ramAdvice,
    ramTargetGb,
  };
}

export async function compatibleGames(
  auth: AuthContext | null,
  input: { specId?: string; cpuId?: string; gpuId?: string; ramGb?: number },
): Promise<CompatibleGames> {
  const rig = await resolveRig(
    auth,
    input.specId
      ? { specId: input.specId }
      : { spec: { cpuId: input.cpuId!, gpuId: input.gpuId!, ramGb: input.ramGb!, storageGb: null } },
  );

  const games = await Game.find({
    status: 'published',
    $or: [{ 'requirements.minimum': { $ne: null } }, { 'requirements.recommended': { $ne: null } }],
  })
    .sort({ popularity: -1 })
    .select(GAME_SUMMARY_FIELDS)
    .lean<GameDoc[]>();

  const buckets: CompatibleGames = { recommended: [], minimum: [], below: [], unknown: [] };
  for (const game of games) {
    const { overall } = evaluate(rig.profile, toGameDetail(game).requirements);
    buckets[overall].push(toGameSummary(game));
  }
  return buckets;
}
