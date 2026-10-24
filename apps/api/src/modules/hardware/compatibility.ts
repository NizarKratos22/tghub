import type { CheckStatus, CompatDimension, CompatDimensionKey, RequirementTier } from '@tgh/shared';

/**
 * Pure compatibility engine — no database, no I/O. It compares a rig against
 * the developer's published tiers and refuses to guess: missing benchmark data
 * yields "unknown", never an optimistic verdict. No FPS numbers are invented.
 */

export interface HardwareProfile {
  cpu: { label: string; score: number | null };
  gpu: { label: string; score: number | null; vramGb: number | null };
  ramGb: number;
  storageGb: number | null;
}

export interface TierPair {
  minimum: RequirementTier | null;
  recommended: RequirementTier | null;
}

export interface Evaluation {
  overall: CheckStatus;
  confidence: 'full' | 'partial' | 'none';
  headline: string;
  detail: string;
  dimensions: CompatDimension[];
  bottleneck: CompatDimensionKey | null;
}

const RANK = { below: 0, minimum: 1, recommended: 2 } as const;
const CORE: CompatDimensionKey[] = ['cpu', 'gpu', 'ram'];
const NAMES: Record<CompatDimensionKey, string> = {
  cpu: 'processor',
  gpu: 'graphics card',
  ram: 'memory',
  vram: 'video memory',
  storage: 'free storage',
};

export function grade(have: number | null, min: number | null, rec: number | null): CheckStatus {
  if (have === null || (min === null && rec === null)) return 'unknown';
  if (rec !== null && have >= rec) return 'recommended';
  if (min !== null) return have >= min ? 'minimum' : 'below';
  // Only a recommended tier exists and we're under it: we can't tell whether it meets minimum.
  return 'unknown';
}

function ratio(have: number | null, min: number | null, rec: number | null): number | null {
  const reference = rec ?? min;
  if (have === null || !reference) return null;
  return Math.round((have / reference) * 100) / 100;
}

const gb = (value: number | null | undefined) => (value === null || value === undefined ? null : `${value} GB`);

export function evaluate(hardware: HardwareProfile, tiers: TierPair): Evaluation {
  const min = tiers.minimum;
  // Some developers publish a single tier (Valve does). Meeting it is the best verdict available.
  const singleTier = !tiers.recommended && Boolean(min);
  const rec = tiers.recommended ?? min;
  const dimensions: CompatDimension[] = [];

  const cpuArgs = [hardware.cpu.score, min?.cpuScore ?? null, rec?.cpuScore ?? null] as const;
  dimensions.push({
    key: 'cpu',
    label: 'Processor',
    have: hardware.cpu.label,
    minimum: min?.cpuLabel ?? null,
    recommended: rec?.cpuLabel ?? null,
    status: grade(...cpuArgs),
    ratio: ratio(...cpuArgs),
  });

  const gpuArgs = [hardware.gpu.score, min?.gpuScore ?? null, rec?.gpuScore ?? null] as const;
  dimensions.push({
    key: 'gpu',
    label: 'Graphics',
    have: hardware.gpu.label,
    minimum: min?.gpuLabel ?? null,
    recommended: rec?.gpuLabel ?? null,
    status: grade(...gpuArgs),
    ratio: ratio(...gpuArgs),
  });

  const ramArgs = [hardware.ramGb, min?.ramGb ?? null, rec?.ramGb ?? null] as const;
  dimensions.push({
    key: 'ram',
    label: 'Memory',
    have: `${hardware.ramGb} GB`,
    minimum: gb(min?.ramGb),
    recommended: gb(rec?.ramGb),
    status: grade(...ramArgs),
    ratio: ratio(...ramArgs),
  });

  if (min?.vramGb || rec?.vramGb) {
    const vramArgs = [hardware.gpu.vramGb, min?.vramGb ?? null, rec?.vramGb ?? null] as const;
    dimensions.push({
      key: 'vram',
      label: 'Video memory',
      have: gb(hardware.gpu.vramGb) ?? 'Shared',
      minimum: gb(min?.vramGb),
      recommended: gb(rec?.vramGb),
      status: grade(...vramArgs),
      ratio: ratio(...vramArgs),
    });
  }

  if (hardware.storageGb !== null && (min?.storageGb || rec?.storageGb)) {
    const storageArgs = [hardware.storageGb, min?.storageGb ?? null, rec?.storageGb ?? null] as const;
    dimensions.push({
      key: 'storage',
      label: 'Free storage',
      have: `${hardware.storageGb} GB`,
      minimum: gb(min?.storageGb),
      recommended: gb(rec?.storageGb),
      status: grade(...storageArgs),
      ratio: ratio(...storageArgs),
    });
  }

  const failing = dimensions.filter((d) => d.status === 'below');
  const coreUnknown = dimensions.filter((d) => CORE.includes(d.key) && d.status === 'unknown');
  const known = dimensions.filter((d) => d.status !== 'unknown');

  let overall: CheckStatus;
  if (failing.length > 0) overall = 'below';
  else if (coreUnknown.length > 0 || known.length === 0) overall = 'unknown';
  else {
    overall = known.reduce<Exclude<CheckStatus, 'unknown'>>((worst, d) => {
      const status = d.status as Exclude<CheckStatus, 'unknown'>;
      return RANK[status] < RANK[worst] ? status : worst;
    }, 'recommended');
  }

  const confidence = coreUnknown.length === 0 ? 'full' : coreUnknown.length < CORE.length ? 'partial' : 'none';

  const bottleneck =
    dimensions
      .filter((d) => CORE.includes(d.key) && d.ratio !== null && d.ratio < 1)
      .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))[0]?.key ?? null;

  const description = describe(overall, failing, bottleneck);
  if (singleTier && overall === 'recommended') {
    description.detail = 'The developer publishes a single spec tier, and your rig meets it.';
  }
  if (singleTier) {
    for (const dimension of dimensions) dimension.recommended = null;
  }
  return { overall, confidence, dimensions, bottleneck, ...description };
}

function list(keys: CompatDimensionKey[]): string {
  const names = keys.map((key) => NAMES[key]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function describe(
  overall: CheckStatus,
  failing: CompatDimension[],
  bottleneck: CompatDimensionKey | null,
): { headline: string; detail: string } {
  switch (overall) {
    case 'recommended':
      return {
        headline: 'Ready to play',
        detail: "Your rig meets or beats the developer's recommended specs.",
      };
    case 'minimum':
      return {
        headline: 'Playable at lower settings',
        detail: bottleneck
          ? `You clear the minimum specs, but your ${NAMES[bottleneck]} is under the recommended tier. Expect to lower settings or resolution.`
          : 'You clear the minimum specs. Expect to lower settings or resolution.',
      };
    case 'below':
      return {
        headline: 'Below minimum',
        detail: `Your ${list(failing.map((d) => d.key))} fall${failing.length === 1 ? 's' : ''} short of the minimum spec. The game may not start or may run poorly.`,
      };
    default:
      return {
        headline: 'Not enough data',
        detail: "We couldn't match every part against benchmark data, so we won't guess a verdict.",
      };
  }
}
