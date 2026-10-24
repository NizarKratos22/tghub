'use client';

import {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_META,
  CURRENCIES,
  homeLabel,
  RESOURCE_KIND_LABELS,
  RESOURCE_KINDS,
  ROLES,
  type AlertCategory,
  type AlertSource,
  type GameSummary,
  type PublishAlertResult,
  type ResourceKind,
  type SourceRunResult,
} from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Avatar, EmptyState, Skeleton, Tag, type TagTone } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { useSession } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api/client';
import styles from './admin.module.css';

const fieldsOf = (error: unknown) => (error instanceof ApiError ? error.fields : {});
const messageOf = (error: unknown) => (error instanceof ApiError && Object.keys(error.fields).length > 0 ? null : error instanceof Error ? error.message : null);

function useGames() {
  return useQuery({ queryKey: ['games', 'all'], queryFn: () => api.games.list({ pageSize: 48, sort: 'title' }), staleTime: 10 * 60_000 });
}

function GameSelect({ value, onChange, label = 'Game', games }: { value: string; onChange: (id: string) => void; label?: string; games: GameSummary[] }) {
  return (
    <SelectField label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">None</option>
      {games.map((game) => (
        <option key={game.id} value={game.id}>
          {game.title}
        </option>
      ))}
    </SelectField>
  );
}

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

/* ───────────── Alerts ───────────── */

function DeliveryList({ result }: { result: PublishAlertResult }) {
  return (
    <div className={styles.result}>
      {result.duplicate ? (
        <p>
          <Tag tone="muted">Duplicate</Tag> An alert with this key already exists — nothing was sent again.
        </p>
      ) : (
        <ul>
          {result.deliveries.map((delivery) => (
            <li key={delivery.id}>
              <Tag tone={delivery.status === 'sent' ? 'success' : delivery.status === 'failed' ? 'danger' : 'muted'}>{delivery.channel}</Tag>
              {delivery.status} · {delivery.recipients} recipient{delivery.recipients === 1 ? '' : 's'}
              {delivery.detail ? ` · ${delivery.detail}` : ''}
            </li>
          ))}
          {result.deliveries.length === 0 ? <li>No channel applied.</li> : null}
        </ul>
      )}
    </div>
  );
}

export function AlertsAdmin() {
  const queryClient = useQueryClient();
  const games = useGames();
  const alerts = useQuery({ queryKey: ['admin', 'alerts'], queryFn: api.admin.alerts });
  const logs = useQuery({ queryKey: ['admin', 'logs'], queryFn: api.admin.deliveryLogs });
  const [form, setForm] = useState({ category: 'announcement' as AlertCategory, title: '', summary: '', url: '', gameId: '', sourceName: 'TG Hub', dedupKey: '' });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: ['session'] });
  };

  const publish = useMutation({
    mutationFn: () =>
      api.admin.publishAlert({
        category: form.category,
        title: form.title,
        summary: form.summary,
        url: form.url || null,
        gameId: form.gameId || null,
        sourceName: form.sourceName,
        ...(form.dedupKey ? { dedupKey: form.dedupKey } : {}),
      }),
    onSuccess: refresh,
  });
  const test = useMutation({ mutationFn: api.admin.testAlert, onSuccess: refresh });
  const fields = fieldsOf(publish.error);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    publish.mutate();
  };

  return (
    <div className={styles.columns}>
      <Panel
        title="Publish alert"
        aside={
          <Button size="sm" variant="outline" onClick={() => test.mutate()} loading={test.isPending}>
            Send test to me
          </Button>
        }
      >
        <form className={styles.form} onSubmit={onSubmit}>
          <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as AlertCategory })}>
            {ALERT_CATEGORIES.filter((c) => c !== 'social').map((category) => (
              <option key={category} value={category}>
                {ALERT_CATEGORY_META[category].label}
              </option>
            ))}
          </SelectField>
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={fields.title} />
          <TextAreaField label="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} error={fields.summary} />
          <TextField label="Link (https://…)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} error={fields.url} />
          <div className={styles.row2}>
            <GameSelect value={form.gameId} onChange={(gameId) => setForm({ ...form, gameId })} games={games.data?.items ?? []} />
            <TextField label="Source name" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} error={fields.sourceName} />
          </div>
          <TextField label="Dedup key (optional)" value={form.dedupKey} onChange={(e) => setForm({ ...form, dedupKey: e.target.value })} hint="Same key = same alert. Defaults to a hash of category + link (or title)." />
          <FormError message={messageOf(publish.error)} />
          <Button type="submit" loading={publish.isPending} icon="bell">
            Publish to subscribers
          </Button>
          {publish.data ? <DeliveryList result={publish.data} /> : null}
          {test.data ? <DeliveryList result={test.data} /> : null}
        </form>
      </Panel>

      <div className={styles.stackCol}>
        <Panel title="Recent alerts">
          {alerts.data ? (
            <table className={styles.table}>
              <tbody>
                {alerts.data.slice(0, 12).map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <Tag tone="muted">{ALERT_CATEGORY_META[alert.category].label}</Tag>
                    </td>
                    <td className={styles.cellTitle}>
                      {alert.title}
                      {alert.targeted ? <span className={styles.dim}> · personal</span> : null}
                    </td>
                    <td className={styles.cellTime}>
                      <RelativeTime iso={alert.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Skeleton height={200} />
          )}
        </Panel>
        <Panel title="Delivery log">
          {logs.data ? (
            <table className={styles.table}>
              <tbody>
                {logs.data.slice(0, 15).map((log) => (
                  <tr key={log.id}>
                    <td>
                      <Tag tone={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'danger' : 'muted'}>{log.channel}</Tag>
                    </td>
                    <td className={styles.cellTitle}>
                      {log.alertTitle}
                      <span className={styles.dim}>
                        {' '}
                        · {log.status} · {log.recipients}
                        {log.detail ? ` · ${log.detail}` : ''}
                      </span>
                    </td>
                    <td className={styles.cellTime}>
                      <RelativeTime iso={log.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Skeleton height={200} />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ───────────── Sources ───────────── */

const HEALTH_TONE: Record<AlertSource['health'], TagTone> = {
  healthy: 'success',
  failing: 'danger',
  disabled: 'muted',
  pending: 'line',
};

export function SourcesAdmin() {
  const queryClient = useQueryClient();
  const games = useGames();
  const sources = useQuery({ queryKey: ['admin', 'sources'], queryFn: api.admin.sources });
  const [lastRun, setLastRun] = useState<SourceRunResult | null>(null);
  const [form, setForm] = useState({ name: '', appId: '', gameId: '', intervalMinutes: '60' });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const run = useMutation({ mutationFn: api.admin.runSource, onSuccess: (result) => (setLastRun(result), refresh()) });
  const toggle = useMutation({ mutationFn: (s: AlertSource) => api.admin.updateSource(s.id, { enabled: !s.enabled }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.admin.deleteSource, onSuccess: refresh });
  const create = useMutation({
    mutationFn: () =>
      api.admin.createSource({
        name: form.name,
        adapter: 'steam_news',
        config: { appId: Number(form.appId) },
        gameId: form.gameId || null,
        category: 'game_update',
        intervalMinutes: Number(form.intervalMinutes),
      }),
    onSuccess: () => (setForm({ name: '', appId: '', gameId: '', intervalMinutes: '60' }), refresh()),
  });
  const fields = fieldsOf(create.error);

  return (
    <div className={styles.stackCol}>
      <Panel title="Alert sources" aside={<span className={styles.dim}>Official Steam announcements · auto-disabled after 5 failures</span>}>
        {sources.data ? (
          sources.data.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Health</th>
                    <th>Last run</th>
                    <th className={styles.num}>Items</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sources.data.map((source) => (
                    <tr key={source.id}>
                      <td className={styles.cellTitle}>
                        {source.name}
                        <span className={styles.dim}>
                          {' '}
                          · app {source.config.appId} · every {source.intervalMinutes}m
                        </span>
                        {source.lastError ? <span className={styles.error}>{source.lastError}</span> : null}
                      </td>
                      <td>
                        <Tag tone={HEALTH_TONE[source.health]}>{source.health}</Tag>
                      </td>
                      <td className={styles.cellTime}>{source.lastRunAt ? <RelativeTime iso={source.lastRunAt} /> : 'never'}</td>
                      <td className={styles.num}>{source.itemsIngested}</td>
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
            <EmptyState title="No sources yet" />
          )
        ) : (
          <Skeleton height={240} />
        )}
        {lastRun ? (
          <p className={styles.result}>
            {lastRun.source.name}: fetched {lastRun.fetched}, {lastRun.newResources} new Radar items, {lastRun.alertsPublished} alerts published.
          </p>
        ) : null}
      </Panel>

      <Panel title="Add Steam source">
        <form
          className={styles.formInline}
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fields.name} />
          <TextField label="Steam app id" inputMode="numeric" value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} error={fields['config.appId']} />
          <GameSelect value={form.gameId} onChange={(gameId) => setForm({ ...form, gameId })} games={games.data?.items ?? []} />
          <SelectField label="Interval" value={form.intervalMinutes} onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })}>
            {[30, 60, 180, 720].map((m) => (
              <option key={m} value={m}>
                Every {m >= 60 ? `${m / 60}h` : `${m}m`}
              </option>
            ))}
          </SelectField>
          <Button type="submit" loading={create.isPending} icon="plus">
            Add
          </Button>
        </form>
        <FormError message={messageOf(create.error)} />
      </Panel>
    </div>
  );
}

/* ───────────── Discord ───────────── */

export function DiscordAdmin() {
  const queryClient = useQueryClient();
  const targets = useQuery({ queryKey: ['admin', 'discord'], queryFn: api.admin.discordTargets });
  const [form, setForm] = useState({ name: '', webhookUrl: '', categories: ['game_update', 'announcement'] as AlertCategory[] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'discord'] });

  const create = useMutation({
    mutationFn: () => api.admin.createDiscordTarget(form),
    onSuccess: () => (setForm({ name: '', webhookUrl: '', categories: ['game_update', 'announcement'] }), refresh()),
  });
  const test = useMutation({ mutationFn: api.admin.testDiscordTarget, onSettled: refresh });
  const toggle = useMutation({ mutationFn: (t: { id: string; enabled: boolean }) => api.admin.updateDiscordTarget(t.id, { enabled: !t.enabled }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.admin.deleteDiscordTarget, onSuccess: refresh });
  const fields = fieldsOf(create.error);

  return (
    <div className={styles.columns}>
      <Panel title="Discord channels">
        {targets.data ? (
          targets.data.length > 0 ? (
            <ul className={styles.targets}>
              {targets.data.map((target) => (
                <li key={target.id}>
                  <div>
                    <p className={styles.cellTitle}>
                      {target.name} <span className={styles.dim}>webhook {target.webhookHint}</span>
                    </p>
                    <p className={styles.dim}>
                      {target.categories.map((c) => ALERT_CATEGORY_META[c].label).join(' · ')}
                      {target.lastDeliveredAt ? ' · last post ' : ''}
                      {target.lastDeliveredAt ? <RelativeTime iso={target.lastDeliveredAt} /> : null}
                    </p>
                    {target.lastError ? <p className={styles.error}>{target.lastError}</p> : null}
                  </div>
                  <div className={styles.actions}>
                    <Button size="sm" variant="outline" onClick={() => test.mutate(target.id)} loading={test.isPending && test.variables === target.id}>
                      Test
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate(target)}>
                      {target.enabled ? 'Pause' : 'Resume'}
                    </Button>
                    <Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${target.name}`} onClick={() => remove.mutate(target.id)} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="bell" title="No Discord channels">
              Add a channel webhook and pick which categories it receives. Personal alerts are never posted.
            </EmptyState>
          )
        ) : (
          <Skeleton height={160} />
        )}
        <FormError message={test.error?.message} />
      </Panel>

      <Panel title="Connect a channel">
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fields.name} placeholder="#patch-notes on TG Hub server" />
          <TextField
            label="Webhook URL"
            value={form.webhookUrl}
            onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
            error={fields.webhookUrl}
            hint="Channel settings → Integrations → Webhooks. Stored server-side, never shown again."
          />
          <fieldset className={styles.checks}>
            <legend className="label">Categories</legend>
            {ALERT_CATEGORIES.filter((c) => c !== 'social').map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={form.categories.includes(category)}
                  onChange={(e) =>
                    setForm({ ...form, categories: e.target.checked ? [...form.categories, category] : form.categories.filter((c) => c !== category) })
                  }
                />
                {ALERT_CATEGORY_META[category].label}
              </label>
            ))}
          </fieldset>
          <FormError message={fields.categories ?? messageOf(create.error)} />
          <Button type="submit" loading={create.isPending} icon="plus">
            Connect
          </Button>
        </form>
      </Panel>
    </div>
  );
}

/* ───────────── Radar content ───────────── */

export function ContentAdmin() {
  const queryClient = useQueryClient();
  const games = useGames();
  const recent = useQuery({ queryKey: ['admin', 'resources'], queryFn: () => api.radar.list({ pageSize: 15 }) });
  const empty = { kind: 'guide' as ResourceKind, title: '', summary: '', url: '', sourceName: 'TG Hub Guides', gameId: '', startsAt: '', expiresAt: '', location: '', store: '', price: '', originalPrice: '', currency: 'USD' };
  const [form, setForm] = useState(empty);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });

  const create = useMutation({
    mutationFn: () =>
      api.admin.createResource({
        kind: form.kind,
        title: form.title,
        summary: form.summary,
        url: form.url,
        sourceName: form.sourceName,
        gameId: form.gameId || null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        location: form.location || null,
        deal:
          form.kind === 'deal'
            ? { store: form.store, price: Number(form.price), originalPrice: form.originalPrice ? Number(form.originalPrice) : null, currency: form.currency }
            : null,
      }),
    onSuccess: () => (setForm({ ...empty, kind: form.kind, sourceName: form.sourceName }), refresh()),
  });
  const remove = useMutation({ mutationFn: api.admin.deleteResource, onSuccess: refresh });
  const fields = fieldsOf(create.error);
  const timed = form.kind === 'deal' || form.kind === 'event';

  return (
    <div className={styles.columns}>
      <Panel title="Add to the Radar">
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className={styles.row2}>
            <SelectField label="Kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ResourceKind })}>
              {RESOURCE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {RESOURCE_KIND_LABELS[kind]}
                </option>
              ))}
            </SelectField>
            <GameSelect value={form.gameId} onChange={(gameId) => setForm({ ...form, gameId })} games={games.data?.items ?? []} />
          </div>
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={fields.title} />
          <TextAreaField label="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} error={fields.summary} />
          <div className={styles.row2}>
            <TextField label="Link (https://…)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} error={fields.url} />
            <TextField label="Source" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} error={fields.sourceName} />
          </div>
          {timed ? (
            <div className={styles.row2}>
              {form.kind === 'event' ? (
                <TextField label="Starts" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} error={fields.startsAt} />
              ) : null}
              <TextField label={form.kind === 'deal' ? 'Expires' : 'Ends'} type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} error={fields.expiresAt} />
              {form.kind === 'event' ? <TextField label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Online · EU / Tunis" /> : null}
            </div>
          ) : null}
          {form.kind === 'deal' ? (
            <div className={styles.row4}>
              <TextField label="Store" value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} error={fields['deal.store'] ?? fields.deal} />
              <TextField label="Price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} error={fields['deal.price']} />
              <TextField label="Was" inputMode="decimal" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
              <SelectField label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectField>
            </div>
          ) : null}
          <FormError message={messageOf(create.error)} />
          <Button type="submit" loading={create.isPending} icon="plus">
            Publish to Radar
          </Button>
        </form>
      </Panel>

      <Panel title="Latest items">
        {recent.data ? (
          <table className={styles.table}>
            <tbody>
              {recent.data.items.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <Tag tone="muted">{RESOURCE_KIND_LABELS[resource.kind]}</Tag>
                  </td>
                  <td className={styles.cellTitle}>
                    {resource.title}
                    <span className={styles.dim}> · {resource.sourceName}</span>
                  </td>
                  <td className={styles.actions}>
                    <Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${resource.title}`} onClick={() => remove.mutate(resource.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Skeleton height={240} />
        )}
      </Panel>
    </div>
  );
}

/* ───────────── Users ───────────── */

export function UsersAdmin() {
  const selfId = useSession().data?.id ?? '';
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const users = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => api.admin.users({ q, pageSize: 25 }) });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, string> }) => api.admin.updateUser(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const clearImages = useMutation({
    mutationFn: (id: string) => api.admin.clearUserImages(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const sellerBadge = useMutation({
    mutationFn: ({ id, override }: { id: string; override: 'auto' | 'verified' | 'revoked' }) => api.admin.setSellerVerification(id, override),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  return (
    <Panel title="Players" aside={<input className={styles.searchInput} placeholder="Search username or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />}>
      <FormError message={update.error?.message ?? clearImages.error?.message ?? sellerBadge.error?.message} />
      {users.data ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Player</th>
                <th>Home</th>
                <th className={styles.num}>LV</th>
                <th>Role</th>
                <th>Status</th>
                <th>Seller badge</th>
                <th>Photos</th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((user) => (
                <tr key={user.id}>
                  <td className={styles.cellTitle}>
                    <span className={styles.playerCell}>
                      <Avatar name={user.displayName} color={user.avatarColor} src={user.avatarUrl} size={28} />
                      <span>
                        {user.username}
                        <span className={styles.dim}> · {user.email}</span>
                      </span>
                    </span>
                  </td>
                  <td>{homeLabel(user) || '—'}</td>
                  <td className={styles.num}>{user.level}</td>
                  <td>
                    <select className={styles.inlineSelect} value={user.role} disabled={user.id === selfId} onChange={(e) => update.mutate({ id: user.id, body: { role: e.target.value } })}>
                      {ROLES.map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant={user.status === 'banned' ? 'secondary' : 'danger'}
                      disabled={user.id === selfId}
                      onClick={() => update.mutate({ id: user.id, body: { status: user.status === 'banned' ? 'active' : 'banned' } })}
                    >
                      {user.status === 'banned' ? 'Reinstate' : 'Suspend'}
                    </Button>
                  </td>
                  <td>
                    <select
                      className={styles.inlineSelect}
                      value={user.sellerOverride}
                      onChange={(e) => sellerBadge.mutate({ id: user.id, override: e.target.value as typeof user.sellerOverride })}
                      aria-label={`Seller badge for ${user.username}`}
                    >
                      <option value="auto">{user.sellerVerified ? 'Auto · verified' : 'Auto'}</option>
                      <option value="verified">Always verified</option>
                      <option value="revoked">Never verified</option>
                    </select>
                  </td>
                  <td>
                    {user.avatarUrl || user.hasBanner ? (
                      <Button size="sm" variant="ghost" icon="trash" loading={clearImages.isPending && clearImages.variables === user.id} onClick={() => clearImages.mutate(user.id)}>
                        Remove
                      </Button>
                    ) : (
                      <span className={styles.dim}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Skeleton height={240} />
      )}
    </Panel>
  );
}

/* ───────────── Missions ───────────── */

export function MissionsAdmin() {
  const queryClient = useQueryClient();
  const missions = useQuery({ queryKey: ['admin', 'missions'], queryFn: api.admin.missions });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.admin.updateMission(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'missions'] }),
  });

  return (
    <Panel title="Missions & rewards" aside={<span className={styles.dim}>Changes apply to the current period immediately</span>}>
      <FormError message={update.error?.message} />
      {missions.data ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mission</th>
                <th>Counts</th>
                <th className={styles.num}>Target</th>
                <th className={styles.num}>XP</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {missions.data.map((mission) => (
                <tr key={mission.id}>
                  <td className={styles.cellTitle}>
                    {mission.title}
                    <span className={styles.dim}> · {mission.cadence}</span>
                  </td>
                  <td className={styles.mono}>{mission.event}</td>
                  <td className={styles.num}>
                    <input
                      className={styles.numInput}
                      type="number"
                      min={1}
                      defaultValue={mission.target}
                      onBlur={(e) => Number(e.target.value) !== mission.target && update.mutate({ id: mission.id, body: { target: Number(e.target.value) } })}
                      aria-label={`${mission.title} target`}
                    />
                  </td>
                  <td className={styles.num}>
                    <input
                      className={styles.numInput}
                      type="number"
                      min={0}
                      defaultValue={mission.xpReward}
                      onBlur={(e) => Number(e.target.value) !== mission.xpReward && update.mutate({ id: mission.id, body: { xpReward: Number(e.target.value) } })}
                      aria-label={`${mission.title} XP reward`}
                    />
                  </td>
                  <td>
                    <Button size="sm" variant={mission.active ? 'secondary' : 'outline'} onClick={() => update.mutate({ id: mission.id, body: { active: !mission.active } })}>
                      {mission.active ? 'On' : 'Off'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Skeleton height={240} />
      )}
    </Panel>
  );
}

/* ───────────── Payments ───────────── */

const ORDER_TONES: Record<string, TagTone> = { paid: 'success', pending: 'gold', failed: 'danger', expired: 'muted' };

export function PaymentsAdmin() {
  const payments = useQuery({ queryKey: ['admin', 'payments'], queryFn: api.admin.payments, refetchInterval: 30_000 });
  if (!payments.data) return <Skeleton height={300} />;
  const { orders, revenue, provider } = payments.data;
  return (
    <Panel
      title="Featured-listing orders"
      aside={
        <span className={styles.dim}>
          {revenue.last30Days} TND last 30 days · {revenue.allTime} TND all time · {provider ? `provider: ${provider}` : 'payments off'}
        </span>
      }
    >
      {orders.length === 0 ? (
        <EmptyState icon="tag" title="No orders yet">
          Sellers feature listings from their listing page.
        </EmptyState>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Seller</th>
                <th className={styles.num}>Days</th>
                <th className={styles.num}>TND</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className={styles.cellTitle}>
                    <Link href={`/market/item/${order.listing.id}`}>{order.listing.title}</Link>
                  </td>
                  <td>{order.buyer.displayName}</td>
                  <td className={styles.num}>{order.days}</td>
                  <td className={styles.num}>{order.priceTnd}</td>
                  <td>
                    {order.provider}
                    {order.providerRef ? <span className={styles.dim}> · {order.providerRef.slice(0, 10)}</span> : null}
                  </td>
                  <td>
                    <Tag tone={ORDER_TONES[order.status] ?? 'muted'}>{order.status}</Tag>
                  </td>
                  <td className={styles.cellTime}>
                    <RelativeTime iso={order.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ───────────── Errors ───────────── */

export function ErrorsAdmin() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [expanded, setExpanded] = useState<string | null>(null);
  const errors = useQuery({ queryKey: ['admin', 'errors', status], queryFn: () => api.admin.errors(status), refetchInterval: 30_000 });
  const resolve = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => api.admin.resolveError(id, resolved),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'errors'] }),
  });
  return (
    <Panel
      title={status === 'open' ? 'Open errors' : 'Resolved'}
      aside={
        <select className={styles.inlineSelect} value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'resolved')} aria-label="Show">
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      }
    >
      <FormError message={resolve.error?.message} />
      {!errors.data ? (
        <Skeleton height={200} />
      ) : errors.data.length === 0 ? (
        <EmptyState icon="check" title={status === 'open' ? 'No open errors' : 'Nothing resolved yet'}>
          {status === 'open' ? 'Crashes from the API and the web app show up here, grouped by cause.' : null}
        </EmptyState>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Error</th>
                <th>Source</th>
                <th className={styles.num}>Events</th>
                <th className={styles.num}>Players</th>
                <th>Last seen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {errors.data.map((event) => (
                <tr key={event.id}>
                  <td className={styles.cellTitle}>
                    <button type="button" className={styles.linkButton} onClick={() => setExpanded(expanded === event.id ? null : event.id)}>
                      {event.name}: {event.message}
                    </button>
                    <span className={styles.dim}> · {event.where ?? 'unknown'}</span>
                    {expanded === event.id && event.stack ? <pre className={styles.stack}>{event.stack}</pre> : null}
                  </td>
                  <td>
                    <Tag tone={event.source === 'api' ? 'primary' : 'purple'}>{event.source}</Tag>
                  </td>
                  <td className={styles.num}>{event.count}</td>
                  <td className={styles.num}>{event.players}</td>
                  <td className={styles.cellTime}>
                    <RelativeTime iso={event.lastSeenAt} />
                  </td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: event.id, resolved: status === 'open' })} disabled={resolve.isPending}>
                      {status === 'open' ? 'Resolve' : 'Reopen'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
