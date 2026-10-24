'use client';

import type { CompatibleGames, CompatResult, GameSummary, PcSpec, RigPreset } from '@tgh/shared';
import { MAX_PC_SPECS_PER_USER } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { EmptyState, Skeleton, StatusBadge, Tag } from '@/components/ui/primitives';
import { SESSION_KEY, useSession, useSignInHref } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { ComponentPicker } from './ComponentPicker';
import { CompatResultView } from './CompatResultView';
import { componentName, isComplete, RAM_OPTIONS, rigFromSpec, toHardware, useRigDraft } from './rig';
import styles from './PcLab.module.css';

function SavedRigs({
  specs,
  activeId,
  onLoad,
}: {
  specs: PcSpec[];
  activeId: string | null;
  onLoad: (spec: PcSpec) => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pc', 'specs'] });
  const makePrimary = useMutation({ mutationFn: (id: string) => api.pc.updateSpec(id, { isPrimary: true }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.pc.deleteSpec(id), onSuccess: refresh });

  return (
    <div className={styles.saved}>
      <p className="label">
        Saved rigs · {specs.length}/{MAX_PC_SPECS_PER_USER}
      </p>
      <ul>
        {specs.map((spec) => (
          <li key={spec.id} className={cx(styles.savedRow, spec.id === activeId && styles.savedActive)}>
            <button type="button" className={styles.savedMain} onClick={() => onLoad(spec)}>
              <span className={styles.savedName}>
                {spec.name} {spec.isPrimary ? <Tag tone="primary">Primary</Tag> : null}
              </span>
              <span className={styles.savedParts}>
                {spec.cpu.model} · {spec.gpu.model} · {spec.ramGb} GB
              </span>
            </button>
            <span className={styles.savedActions}>
              {!spec.isPrimary ? (
                <Button size="sm" variant="ghost" onClick={() => makePrimary.mutate(spec.id)} disabled={makePrimary.isPending}>
                  Make primary
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${spec.name}`} onClick={() => remove.mutate(spec.id)} disabled={remove.isPending} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One click to try a typical machine instead of searching part by part. */
function Presets({ onPick }: { onPick: (preset: RigPreset) => void }) {
  const presets = useQuery({ queryKey: ['pc', 'presets'], queryFn: api.pc.presets, staleTime: 60 * 60_000 });
  if (!presets.data || presets.data.length === 0) return null;
  return (
    <div className={styles.presets}>
      <p className="label">Start from a common setup</p>
      <ul>
        {presets.data.map((preset) => (
          <li key={preset.id}>
            <button type="button" className={styles.preset} onClick={() => onPick(preset)} aria-describedby={`preset-${preset.id}`}>
              <span className={styles.presetName}>{preset.name}</span>
              <span className={styles.presetParts}>
                {preset.cpu.model} · {preset.gpu.model} · {preset.ramGb} GB
              </span>
              <span id={`preset-${preset.id}`} className="visually-hidden">
                {preset.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GameColumn({ title, status, games }: { title: string; status: CompatResult['overall']; games: GameSummary[] }) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHead}>
        <StatusBadge status={status} size="sm" />
        <span className={styles.columnCount}>{games.length}</span>
      </div>
      {games.length > 0 ? (
        <ul>
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/games/${game.slug}`} className={styles.gameLink} style={{ '--accent': game.accent } as CSSProperties}>
                <span className={styles.gameMono}>{game.monogram}</span>
                {game.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.columnEmpty}>None {title.toLowerCase()}.</p>
      )}
    </div>
  );
}

function CompatibleGamesView({ data }: { data: CompatibleGames }) {
  return (
    <div className={styles.columns}>
      <GameColumn title="At recommended" status="recommended" games={data.recommended} />
      <GameColumn title="At minimum" status="minimum" games={data.minimum} />
      <GameColumn title="Below minimum" status="below" games={data.below} />
      {data.unknown.length > 0 ? <GameColumn title="Without data" status="unknown" games={data.unknown} /> : null}
    </div>
  );
}

export function PcLab({ initialGame }: { initialGame?: string }) {
  const { data: me } = useSession();
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const { rig, update, loaded } = useRigDraft();
  const [gameSlug, setGameSlug] = useState(initialGame ?? '');
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [rigName, setRigName] = useState('Main rig');

  const specs = useQuery({ queryKey: ['pc', 'specs'], queryFn: api.pc.specs, enabled: Boolean(me) });
  const games = useQuery({
    queryKey: ['games', 'pc-list'],
    queryFn: () => api.games.list({ platform: 'pc', pageSize: 48, sort: 'title' }),
    staleTime: 10 * 60_000,
  });
  const pcGames = (games.data?.items ?? []).filter((game) => game.hasPcRequirements);

  const hardware = isComplete(rig) ? toHardware(rig) : null;

  const check = useQuery({
    queryKey: ['pc', 'check', gameSlug, hardware],
    queryFn: async () => {
      const result = await api.pc.check({ gameSlug, spec: hardware! });
      void queryClient.invalidateQueries({ queryKey: ['universe'] });
      return result;
    },
    enabled: Boolean(gameSlug && hardware),
    staleTime: 5 * 60_000,
  });

  const compatible = useQuery({
    queryKey: ['pc', 'compatible', hardware?.cpuId, hardware?.gpuId, hardware?.ramGb],
    queryFn: () => api.pc.compatibleGames({ cpuId: hardware!.cpuId, gpuId: hardware!.gpuId, ramGb: hardware!.ramGb }),
    enabled: Boolean(hardware),
    staleTime: 5 * 60_000,
  });

  // A saved draft can point at a part that has since left the index: drop it so the picker reopens.
  useEffect(() => {
    const error = check.error ?? compatible.error;
    if (!(error instanceof ApiError)) return;
    if (error.fields.cpuId) update({ cpu: null });
    if (error.fields.gpuId) update({ gpu: null });
  }, [check.error, compatible.error, update]);

  const save = useMutation({
    mutationFn: () =>
      activeSpecId
        ? api.pc.updateSpec(activeSpecId, { ...hardware, name: rigName })
        : api.pc.createSpec({ ...hardware, name: rigName }),
    onSuccess: (spec) => {
      setActiveSpecId(spec.id);
      void queryClient.invalidateQueries({ queryKey: ['pc', 'specs'] });
      void queryClient.invalidateQueries({ queryKey: ['universe'] });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
  const saveError = save.error instanceof ApiError ? save.error : null;

  const loadSpec = (spec: PcSpec) => {
    update(rigFromSpec(spec));
    setActiveSpecId(spec.id);
    setRigName(spec.name);
  };

  if (!loaded) return <Skeleton height={420} />;

  return (
    <>
      <div className={styles.lab}>
        <section className={styles.panel} aria-labelledby="rig-title">
          <h2 id="rig-title" className={styles.step}>
            <span>A</span> Your rig
          </h2>
          <Presets
            onPick={(preset) => {
              update({ cpu: preset.cpu, gpu: preset.gpu, ramGb: preset.ramGb });
              setActiveSpecId(null);
              setRigName(preset.name);
            }}
          />
          <div className={styles.fields}>
            <ComponentPicker type="cpu" label="Processor" value={rig.cpu} onChange={(cpu) => update({ cpu })} placeholder="Search — e.g. 5600, i5 12400" />
            <ComponentPicker type="gpu" label="Graphics card" value={rig.gpu} onChange={(gpu) => update({ gpu })} placeholder="Search — e.g. 3060, rx 580, 1650" />
            <div className={styles.ram}>
              <span className="label">Memory</span>
              <div className={styles.ramOptions} role="radiogroup" aria-label="Memory">
                {RAM_OPTIONS.map((gb) => (
                  <button key={gb} type="button" role="radio" aria-checked={rig.ramGb === gb} className={cx(styles.ramOption, rig.ramGb === gb && styles.ramOn)} onClick={() => update({ ramGb: gb })}>
                    {gb}
                    <small>GB</small>
                  </button>
                ))}
              </div>
            </div>
            <TextField
              label="Free storage (GB)"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Optional"
              value={rig.storageGb ?? ''}
              onChange={(event) => update({ storageGb: event.target.value === '' ? null : Math.max(0, Math.floor(Number(event.target.value))) })}
              hint="Leave empty if you're not sure — we'll skip the storage check."
            />
          </div>

          {me ? (
            <div className={styles.saveRow}>
              <TextField label="Rig name" value={rigName} onChange={(event) => setRigName(event.target.value)} error={saveError?.fields.name} wrapperClassName={styles.nameField} />
              <Button onClick={() => save.mutate()} disabled={!hardware || !rigName.trim()} loading={save.isPending} icon="check">
                {activeSpecId ? 'Update rig' : 'Save rig'}
              </Button>
              {activeSpecId ? (
                <Button variant="ghost" onClick={() => setActiveSpecId(null)}>
                  Save as new
                </Button>
              ) : null}
            </div>
          ) : (
            <p className={styles.note}>
              Your rig is kept in this browser. <Link href={signInHref}>Sign in</Link> to save it to your profile and earn the “Build your rig” mission.
            </p>
          )}
          <FormError message={save.error && !saveError?.fields.name ? save.error.message : null} />

          {me && specs.data && specs.data.length > 0 ? <SavedRigs specs={specs.data} activeId={activeSpecId} onLoad={loadSpec} /> : null}
        </section>

        <section className={styles.panel} aria-labelledby="check-title">
          <h2 id="check-title" className={styles.step}>
            <span>B</span> Pick a game
          </h2>
          <SelectField label="Game" value={gameSlug} onChange={(event) => setGameSlug(event.target.value)}>
            <option value="">Choose a PC game…</option>
            {pcGames.map((game) => (
              <option key={game.slug} value={game.slug}>
                {game.title}
              </option>
            ))}
          </SelectField>
          <div className={styles.result}>
            {!hardware ? (
              <EmptyState icon="cpu" title="Start with your parts">
                Pick a processor and a graphics card on the left.
              </EmptyState>
            ) : !gameSlug ? (
              <EmptyState icon="gamepad" title="Now pick a game">
                Checking with {componentName(rig.cpu!)} and {componentName(rig.gpu!)}, {rig.ramGb} GB RAM.
              </EmptyState>
            ) : check.data ? (
              <CompatResultView result={check.data} />
            ) : check.isError ? (
              <FormError message={check.error.message} />
            ) : (
              <Skeleton height={300} />
            )}
          </div>
        </section>
      </div>

      <section className={styles.runs} aria-labelledby="runs-title">
        <h2 id="runs-title" className={styles.step}>
          <span>C</span> What this rig runs
        </h2>
        {!hardware ? (
          <p className={styles.note}>Complete your rig to see every game in the catalogue sorted by verdict.</p>
        ) : compatible.data ? (
          <CompatibleGamesView data={compatible.data} />
        ) : (
          <Skeleton height={200} />
        )}
      </section>
    </>
  );
}
