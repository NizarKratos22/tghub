'use client';

import type {
  AdminTournament,
  DiscoveryProvider,
  GameSummary,
  StartggVideogame,
  TournamentImportResult,
  TournamentSource,
  TournamentSourceRunResult,
} from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { EmptyState, Skeleton, Tag, type TagTone } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { ProviderBadge, TournamentStatusBadge } from '@/features/tournaments/badges';
import { api, ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import styles from './admin.module.css';

const fieldsOf = (error: unknown) => (error instanceof ApiError ? error.fields : {});
const messageOf = (error: unknown) => (error instanceof ApiError && Object.keys(error.fields).length > 0 ? null : error instanceof Error ? error.message : null);

const HEALTH_TONE: Record<TournamentSource['health'], TagTone> = {
  healthy: 'success',
  failing: 'danger',
  disabled: 'muted',
  pending: 'line',
};

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function describeConfig(source: TournamentSource): string {
  const config = source.config as Record<string, string | number | null>;
  if (source.provider === 'startgg') return `videogame ${config.videogameId}${config.countryCode ? ` · ${config.countryCode}` : ' · worldwide'}`;
  return `${config.game}${config.region ? ` · ${config.region}` : ''}`;
}

/* ───────────── Providers + import ───────────── */

function Connections() {
  const queryClient = useQueryClient();
  const providers = useQuery({ queryKey: ['admin', 'tournaments', 'providers'], queryFn: api.admin.tournaments.providers });
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<TournamentImportResult | null>(null);
  const importer = useMutation({
    mutationFn: () => api.admin.tournaments.import(url),
    onSuccess: (data) => {
      setResult(data);
      setUrl('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });

  return (
    <div className={styles.columns}>
      <Panel title="Platforms">
        {providers.data ? (
          <ul className={styles.targets}>
            {providers.data.map((provider) => (
              <li key={provider.provider}>
                <div>
                  <p className={styles.cellTitle}>{provider.label}</p>
                  <p className={styles.dim}>
                    {provider.configured ? 'Connected — discovery, refresh and import are active.' : `Not connected. Set ${provider.credentialEnv} on the API server.`}
                  </p>
                </div>
                <Tag tone={provider.configured ? 'success' : 'muted'}>{provider.configured ? 'Connected' : 'Off'}</Tag>
              </li>
            ))}
          </ul>
        ) : (
          <Skeleton height={120} />
        )}
        <p className={styles.dim} style={{ marginTop: 12 }}>
          TG Hub only mirrors tournaments. Organizers create and run them on these platforms.
        </p>
      </Panel>

      <Panel title="Import by link">
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            setResult(null);
            importer.mutate();
          }}
        >
          <TextField
            label="Tournament URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.start.gg/tournament/… or https://www.faceit.com/en/championship/…"
            error={fieldsOf(importer.error).url}
            hint="For a Tunisian organizer's event that discovery hasn't picked up yet."
          />
          <FormError message={messageOf(importer.error)} />
          <Button type="submit" icon="plus" loading={importer.isPending} disabled={!url.trim()}>
            Import
          </Button>
          {result ? (
            <p className={styles.result}>
              {result.created ? 'Imported' : 'Already mirrored — refreshed'}:{' '}
              <Link href={`/tournaments/${result.tournament.slug}`}>{result.tournament.name}</Link>
            </p>
          ) : null}
        </form>
      </Panel>
    </div>
  );
}

/* ───────────── Discovery sources ───────────── */

function StartggGamePicker({ onPick }: { onPick: (game: StartggVideogame) => void }) {
  const [q, setQ] = useState('');
  const lookup = useMutation({ mutationFn: () => api.admin.tournaments.startggGames(q) });
  return (
    <div className={styles.form}>
      <div className={styles.row2}>
        <TextField label="Find start.gg game" value={q} onChange={(event) => setQ(event.target.value)} placeholder="tekken" />
        <div style={{ alignSelf: 'end' }}>
          <Button variant="outline" onClick={() => lookup.mutate()} loading={lookup.isPending} disabled={q.trim().length < 2}>
            Look up
          </Button>
        </div>
      </div>
      <FormError message={lookup.error?.message} />
      {lookup.data ? (
        <ul className={styles.checks}>
          {lookup.data.map((game) => (
            <li key={game.id}>
              <Button size="sm" variant="ghost" onClick={() => onPick(game)}>
                {game.displayName} · id {game.id}
              </Button>
            </li>
          ))}
          {lookup.data.length === 0 ? <li className={styles.dim}>No match on start.gg.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function SourceForm({ games }: { games: GameSummary[] }) {
  const queryClient = useQueryClient();
  const empty = { provider: 'startgg' as DiscoveryProvider, name: '', gameId: '', intervalMinutes: '180', videogameId: '', countryCode: 'TN', faceitGame: 'cs2', region: 'EU' };
  const [form, setForm] = useState(empty);
  const create = useMutation({
    mutationFn: () =>
      api.admin.tournaments.createSource({
        provider: form.provider,
        name: form.name,
        gameId: form.gameId || null,
        intervalMinutes: Number(form.intervalMinutes),
        config:
          form.provider === 'startgg'
            ? { videogameId: Number(form.videogameId), countryCode: form.countryCode || null }
            : { game: form.faceitGame, region: form.region || null },
      }),
    onSuccess: () => {
      setForm({ ...empty, provider: form.provider });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });
  const fields = fieldsOf(create.error);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className={styles.row2}>
        <SelectField label="Platform" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as DiscoveryProvider })}>
          <option value="startgg">start.gg</option>
          <option value="faceit">FACEIT</option>
        </SelectField>
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fields.name} placeholder="Tekken 8 — Tunisia" />
      </div>
      {form.provider === 'startgg' ? (
        <>
          <StartggGamePicker onPick={(game) => setForm({ ...form, videogameId: String(game.id), name: form.name || `${game.displayName} — Tunisia` })} />
          <div className={styles.row2}>
            <TextField label="start.gg videogame id" inputMode="numeric" value={form.videogameId} onChange={(e) => setForm({ ...form, videogameId: e.target.value })} error={fields['config.videogameId']} />
            <TextField
              label="Country (ISO code)"
              value={form.countryCode}
              maxLength={2}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
              error={fields['config.countryCode']}
              hint="TN for Tunisia; empty = worldwide."
            />
          </div>
        </>
      ) : (
        <div className={styles.row2}>
          <TextField label="FACEIT game id" value={form.faceitGame} onChange={(e) => setForm({ ...form, faceitGame: e.target.value })} error={fields['config.game']} hint="e.g. cs2, dota2" />
          <TextField label="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} hint="e.g. EU; empty = all regions." />
        </div>
      )}
      <div className={styles.row2}>
        <SelectField label="Catalogue game" value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })} hint="Attach discovered tournaments to this game.">
          <option value="">Match by name</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="Check every" value={form.intervalMinutes} onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })}>
          {[60, 180, 360, 720].map((m) => (
            <option key={m} value={m}>
              {m / 60}h
            </option>
          ))}
        </SelectField>
      </div>
      <FormError message={messageOf(create.error)} />
      <Button type="submit" icon="plus" loading={create.isPending}>
        Add source
      </Button>
    </form>
  );
}

function Sources() {
  const queryClient = useQueryClient();
  const games = useQuery({ queryKey: ['games', 'all'], queryFn: () => api.games.list({ pageSize: 48, sort: 'title' }), staleTime: 10 * 60_000 });
  const sources = useQuery({ queryKey: ['admin', 'tournaments', 'sources'], queryFn: api.admin.tournaments.sources });
  const [lastRun, setLastRun] = useState<TournamentSourceRunResult | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
  const run = useMutation({ mutationFn: api.admin.tournaments.runSource, onSuccess: (r) => (setLastRun(r), refresh()) });
  const toggle = useMutation({ mutationFn: (s: TournamentSource) => api.admin.tournaments.updateSource(s.id, { enabled: !s.enabled }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.admin.tournaments.deleteSource, onSuccess: refresh });

  return (
    <div className={styles.columns}>
      <Panel title="Discovery sources" aside={<span className={styles.dim}>Polled on their interval when ingestion is enabled</span>}>
        {sources.data ? (
          sources.data.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <tbody>
                  {sources.data.map((source) => (
                    <tr key={source.id}>
                      <td className={styles.cellTitle}>
                        {source.name}
                        <span className={styles.dim}>
                          {' '}
                          · {describeConfig(source)} · {source.itemsIngested} found
                        </span>
                        {source.lastError ? <span className={styles.error}>{source.lastError}</span> : null}
                      </td>
                      <td>
                        <Tag tone={HEALTH_TONE[source.health]}>{source.health}</Tag>
                      </td>
                      <td className={styles.cellTime}>{source.lastRunAt ? <RelativeTime iso={source.lastRunAt} /> : 'never'}</td>
                      <td className={styles.actions}>
                        <Button size="sm" variant="outline" onClick={() => run.mutate(source.id)} loading={run.isPending && run.variables === source.id}>
                          Run now
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle.mutate(source)}>
                          {source.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${source.name}`} onClick={() => remove.mutate(source.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="trophy" title="No sources yet">
              Add a start.gg game + country, or a FACEIT game + region, to discover tournaments automatically.
            </EmptyState>
          )
        ) : (
          <Skeleton height={160} />
        )}
        {lastRun ? (
          <p className={styles.result}>
            {lastRun.source.name}: fetched {lastRun.fetched}, {lastRun.created} new, {lastRun.updated} refreshed.
          </p>
        ) : null}
      </Panel>
      <Panel title="Add source">
        <SourceForm games={games.data?.items ?? []} />
      </Panel>
    </div>
  );
}

/* ───────────── Moderation ───────────── */

function Moderation() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['admin', 'tournaments', 'list', q], queryFn: () => api.admin.tournaments.list({ q, pageSize: 25 }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments', 'list'] });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.admin.tournaments.update(id, body),
    onSuccess: refresh,
  });
  const sync = useMutation({ mutationFn: api.admin.tournaments.sync, onSuccess: refresh });

  const row = (t: AdminTournament) => (
    <tr key={t.id} style={t.hidden ? { opacity: 0.5 } : undefined}>
      <td className={styles.cellTitle}>
        <Link href={`/tournaments/${t.slug}`}>{t.name}</Link>
        <span className={styles.dim}>
          {' '}
          · {t.game?.title ?? t.gameName ?? 'no game'} · {formatDateTime(t.startsAt)}
          {t.sourceName ? ` · via ${t.sourceName}` : ''}
        </span>
      </td>
      <td>
        <TournamentStatusBadge status={t.status} />
      </td>
      <td>
        <ProviderBadge provider={t.provider} />
      </td>
      <td className={styles.actions}>
        <Button size="sm" variant={t.featured ? 'secondary' : 'ghost'} onClick={() => update.mutate({ id: t.id, body: { featured: !t.featured } })}>
          {t.featured ? 'Featured' : 'Feature'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: t.id, body: { hidden: !t.hidden } })}>
          {t.hidden ? 'Show' : 'Hide'}
        </Button>
        {t.provider !== 'sample' ? (
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => sync.mutate(t.id)} loading={sync.isPending && sync.variables === t.id}>
            Sync
          </Button>
        ) : null}
      </td>
    </tr>
  );

  return (
    <Panel title="Mirrored tournaments" aside={<input className={styles.searchInput} placeholder="Search tournaments" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tournaments" />}>
      <FormError message={update.error?.message ?? sync.error?.message} />
      {list.data ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>{list.data.items.map(row)}</tbody>
          </table>
        </div>
      ) : (
        <Skeleton height={240} />
      )}
    </Panel>
  );
}

export function TournamentsAdmin() {
  return (
    <div className={styles.stackCol}>
      <Connections />
      <Sources />
      <Moderation />
    </div>
  );
}
