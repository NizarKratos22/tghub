'use client';

import { MISSION_CADENCES, TRACKABLE_EVENTS, type AdminAchievement, type AdminMission, type AdminSeason, type MissionCadence, type TrackableEvent } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextField } from '@/components/ui/Field';
import { Meter, Skeleton, Tag } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatDate, formatNumber } from '@/lib/format';
import { fieldsOf, messageOf, Panel } from './sections';
import styles from './admin.module.css';

/** What each trackable action means, in admin words. */
const EVENT_LABELS: Record<TrackableEvent, string> = {
  'user.registered': 'Creates an account',
  'user.daily_login': 'Opens TG Hub (once a day)',
  'game.viewed': 'Opens a game page',
  'game.favorited': 'Favourites a game',
  'pc.spec_saved': 'Saves a rig in PC Lab',
  'pc.compat_checked': 'Checks a rig against a game',
  'radar.searched': 'Searches the Radar',
  'tournament.followed': 'Follows a tournament',
};
const CADENCE_LABELS: Record<MissionCadence, string> = { daily: 'Daily', weekly: 'Weekly', special: 'Season' };

/** datetime-local value ↔ ISO string */
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

function useRefresh(...keys: string[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: ['admin', key] });
    // Players see changes on their next visit; drop this browser's cached Universe too.
    void queryClient.invalidateQueries({ queryKey: ['universe'] });
  };
}

/* ───────────── Missions ───────────── */

const EMPTY_MISSION = { title: '', description: '', cadence: 'daily' as MissionCadence, event: 'radar.searched' as TrackableEvent, target: '1', xpReward: '30', startsAt: '', endsAt: '' };

function NewMission() {
  const refresh = useRefresh('missions');
  const [form, setForm] = useState(EMPTY_MISSION);
  const create = useMutation({
    mutationFn: () =>
      api.admin.createMission({
        title: form.title,
        description: form.description,
        cadence: form.cadence,
        event: form.event,
        target: Number(form.target),
        xpReward: Number(form.xpReward),
        startsAt: form.cadence === 'special' ? toIso(form.startsAt) : null,
        endsAt: form.cadence === 'special' ? toIso(form.endsAt) : null,
      }),
    onSuccess: () => (setForm(EMPTY_MISSION), refresh()),
  });
  const fields = fieldsOf(create.error);
  const submit = (event: FormEvent) => (event.preventDefault(), create.mutate());

  return (
    <details className={styles.adder}>
      <summary>New mission</summary>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.row2}>
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={fields.title} placeholder="Weekend warrior" />
          <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={fields.description} placeholder="Check 2 rigs this weekend." />
        </div>
        <div className={styles.row4}>
          <SelectField label="Counts when a player…" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value as TrackableEvent })}>
            {TRACKABLE_EVENTS.map((event) => (
              <option key={event} value={event}>
                {EVENT_LABELS[event]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Resets" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as MissionCadence })}>
            {MISSION_CADENCES.map((cadence) => (
              <option key={cadence} value={cadence}>
                {CADENCE_LABELS[cadence]}
              </option>
            ))}
          </SelectField>
          <TextField label="Times" type="number" min={1} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} error={fields.target} />
          <TextField label="XP reward" type="number" min={0} value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: e.target.value })} error={fields.xpReward} />
        </div>
        {form.cadence === 'special' ? (
          <div className={styles.row2}>
            <TextField label="Starts" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} error={fields.startsAt} />
            <TextField label="Ends" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} error={fields.endsAt} />
          </div>
        ) : null}
        <FormError message={messageOf(create.error)} />
        <Button type="submit" icon="plus" loading={create.isPending}>
          Add mission
        </Button>
      </form>
    </details>
  );
}

function Missions() {
  const refresh = useRefresh('missions');
  const missions = useQuery({ queryKey: ['admin', 'missions'], queryFn: api.admin.missions });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.admin.updateMission(id, body), onSuccess: refresh });
  const remove = useMutation({ mutationFn: api.admin.deleteMission, onSuccess: refresh });
  const ask = (mission: AdminMission) =>
    window.confirm(`Delete "${mission.title}"? Everyone's progress on it goes; XP already claimed from it stays.`) && remove.mutate(mission.id);

  return (
    <Panel title="Missions" aside={<span className={styles.dim}>Edits apply to the current period immediately</span>}>
      <FormError message={update.error?.message ?? remove.error?.message} />
      {missions.data ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mission</th>
                <th>Counts when a player…</th>
                <th className={styles.num}>Times</th>
                <th className={styles.num}>XP</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {missions.data.map((mission) => (
                <tr key={mission.id}>
                  <td className={styles.cellTitle}>
                    {mission.title}
                    <span className={styles.dim}>
                      {' '}
                      · {CADENCE_LABELS[mission.cadence]}
                      {mission.cadence === 'special' && mission.endsAt ? ` · until ${formatDate(mission.endsAt)}` : ''}
                    </span>
                    {mission.description ? <span className={styles.sub}>{mission.description}</span> : null}
                  </td>
                  <td>{EVENT_LABELS[mission.event]}</td>
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
                  <td className={styles.actions}>
                    <Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${mission.title}`} onClick={() => ask(mission)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Skeleton height={240} />
      )}
      <NewMission />
    </Panel>
  );
}

/* ───────────── Achievements ───────────── */

type AchievementForm = {
  title: string;
  description: string;
  kind: 'event_count' | 'level';
  event: TrackableEvent;
  count: string;
  level: string;
  xpReward: string;
  cosmeticKind: '' | 'title' | 'badge';
  cosmeticValue: string;
};
const EMPTY_ACHIEVEMENT: AchievementForm = { title: '', description: '', kind: 'event_count', event: 'radar.searched', count: '10', level: '5', xpReward: '100', cosmeticKind: '', cosmeticValue: '' };

const formFrom = (a: AdminAchievement): AchievementForm => ({
  title: a.title,
  description: a.description,
  kind: a.criteria.kind,
  event: a.criteria.kind === 'event_count' ? a.criteria.event : 'radar.searched',
  count: a.criteria.kind === 'event_count' ? String(a.criteria.count) : '10',
  level: a.criteria.kind === 'level' ? String(a.criteria.level) : '5',
  xpReward: String(a.xpReward),
  cosmeticKind: a.cosmetic?.kind ?? '',
  cosmeticValue: a.cosmetic?.value ?? '',
});

const describeCriteria = (a: AdminAchievement) =>
  a.criteria.kind === 'level' ? `Reach level ${a.criteria.level}` : `${EVENT_LABELS[a.criteria.event]} × ${formatNumber(a.criteria.count)}`;

function AchievementEditor({ editing, onDone }: { editing: AdminAchievement | null; onDone: () => void }) {
  const refresh = useRefresh('achievements');
  const [form, setForm] = useState<AchievementForm>(editing ? formFrom(editing) : EMPTY_ACHIEVEMENT);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        description: form.description,
        criteria: form.kind === 'level' ? { kind: 'level', level: Number(form.level) } : { kind: 'event_count', event: form.event, count: Number(form.count) },
        xpReward: Number(form.xpReward),
        cosmetic: form.cosmeticKind ? { kind: form.cosmeticKind, value: form.cosmeticValue } : null,
      };
      return editing ? api.admin.updateAchievement(editing.id, body) : api.admin.createAchievement(body);
    },
    onSuccess: () => {
      refresh();
      setForm(EMPTY_ACHIEVEMENT);
      onDone();
    },
  });
  const fields = fieldsOf(save.error);

  return (
    <form className={styles.form} onSubmit={(event) => (event.preventDefault(), save.mutate())}>
      <p className={styles.formTitle}>{editing ? `Edit “${editing.title}”` : 'New achievement'}</p>
      <div className={styles.row2}>
        <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={fields.title} />
        <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={fields.description} />
      </div>
      <div className={styles.row4}>
        <SelectField label="Unlocks when a player…" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AchievementForm['kind'] })}>
          <option value="event_count">Does something a number of times</option>
          <option value="level">Reaches a level</option>
        </SelectField>
        {form.kind === 'event_count' ? (
          <>
            <SelectField label="Action" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value as TrackableEvent })}>
              {TRACKABLE_EVENTS.map((event) => (
                <option key={event} value={event}>
                  {EVENT_LABELS[event]}
                </option>
              ))}
            </SelectField>
            <TextField label="Times" type="number" min={1} value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} error={fields['criteria.count']} />
          </>
        ) : (
          <TextField label="Level" type="number" min={2} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} error={fields['criteria.level']} />
        )}
        <TextField label="XP reward" type="number" min={0} value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: e.target.value })} error={fields.xpReward} />
      </div>
      <div className={styles.row2}>
        <SelectField label="Extra reward" value={form.cosmeticKind} onChange={(e) => setForm({ ...form, cosmeticKind: e.target.value as AchievementForm['cosmeticKind'] })}>
          <option value="">None</option>
          <option value="title">A title players can wear</option>
          <option value="badge">A profile badge</option>
        </SelectField>
        {form.cosmeticKind ? (
          <TextField
            label={form.cosmeticKind === 'title' ? 'Title' : 'Badge name'}
            value={form.cosmeticValue}
            onChange={(e) => setForm({ ...form, cosmeticValue: e.target.value })}
            error={fields['cosmetic.value']}
          />
        ) : null}
      </div>
      <p className={styles.dim}>Players who already qualify get it straight away, with its XP.</p>
      <FormError message={messageOf(save.error)} />
      <div className={styles.buttons}>
        <Button type="submit" icon={editing ? 'check' : 'plus'} loading={save.isPending}>
          {editing ? 'Save changes' : 'Add achievement'}
        </Button>
        {editing ? (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Achievements() {
  const refresh = useRefresh('achievements');
  const achievements = useQuery({ queryKey: ['admin', 'achievements'], queryFn: api.admin.achievements });
  const [editing, setEditing] = useState<AdminAchievement | null>(null);
  const remove = useMutation({ mutationFn: api.admin.deleteAchievement, onSuccess: refresh });
  const ask = (a: AdminAchievement) =>
    window.confirm(`Delete "${a.title}"? ${a.unlocked} player(s) lose it${a.cosmetic?.kind === 'title' ? ' and its title' : ''}; XP it gave stays.`) && remove.mutate(a.id);

  return (
    <Panel title="Achievements" aside={<span className={styles.dim}>One-time unlocks, counted on the server</span>}>
      <FormError message={remove.error?.message} />
      {achievements.data ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Achievement</th>
                <th>Requirement</th>
                <th className={styles.num}>XP</th>
                <th>Reward</th>
                <th className={styles.num}>Players</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {achievements.data.map((a) => (
                <tr key={a.id} className={cx(editing?.id === a.id && styles.rowEditing)}>
                  <td className={styles.cellTitle}>
                    {a.title}
                    {a.description ? <span className={styles.sub}>{a.description}</span> : null}
                  </td>
                  <td>{describeCriteria(a)}</td>
                  <td className={styles.num}>{formatNumber(a.xpReward)}</td>
                  <td>{a.cosmetic ? <Tag tone={a.cosmetic.kind === 'title' ? 'purple' : 'gold'}>{a.cosmetic.kind === 'title' ? `Title · ${a.cosmetic.value}` : `Badge · ${a.cosmetic.value}`}</Tag> : '—'}</td>
                  <td className={styles.num}>{formatNumber(a.unlocked)}</td>
                  <td className={styles.actions}>
                    <Button size="sm" variant="ghost" icon="edit" aria-label={`Edit ${a.title}`} onClick={() => setEditing(a)} />
                    <Button size="sm" variant="ghost" icon="trash" aria-label={`Delete ${a.title}`} onClick={() => ask(a)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Skeleton height={240} />
      )}
      <AchievementEditor key={editing?.id ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
    </Panel>
  );
}

/* ───────────── Seasons & Pulse ───────────── */

type SeasonForm = { title: string; description: string; goal: string; startsAt: string; endsAt: string; milestones: Array<{ percent: string; reward: string }> };
const EMPTY_SEASON: SeasonForm = {
  title: '',
  description: 'Every XP point anyone earns feeds one shared meter. Hit the milestones together, unlock rewards for everyone.',
  goal: '100000',
  startsAt: '',
  endsAt: '',
  milestones: [
    { percent: '25', reward: '' },
    { percent: '50', reward: '' },
    { percent: '100', reward: '' },
  ],
};
const seasonForm = (s: AdminSeason): SeasonForm => ({
  title: s.title,
  description: s.description,
  goal: String(s.goal),
  startsAt: toLocalInput(s.startsAt),
  endsAt: toLocalInput(s.endsAt),
  milestones: s.milestones.map((m) => ({ percent: String(m.percent), reward: m.reward })),
});

function SeasonEditor({ editing, onDone }: { editing: AdminSeason | null; onDone: () => void }) {
  const refresh = useRefresh('seasons');
  const [form, setForm] = useState<SeasonForm>(editing ? seasonForm(editing) : EMPTY_SEASON);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        description: form.description,
        goal: Number(form.goal),
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
        milestones: form.milestones.filter((m) => m.reward.trim()).map((m) => ({ percent: Number(m.percent), reward: m.reward })),
      };
      return editing ? api.admin.updateSeason(editing.key, body) : api.admin.createSeason(body);
    },
    onSuccess: () => {
      refresh();
      setForm(EMPTY_SEASON);
      onDone();
    },
  });
  const fields = fieldsOf(save.error);
  const setMilestone = (index: number, changes: Partial<SeasonForm['milestones'][number]>) =>
    setForm({ ...form, milestones: form.milestones.map((m, i) => (i === index ? { ...m, ...changes } : m)) });

  return (
    <form className={styles.form} onSubmit={(event) => (event.preventDefault(), save.mutate())}>
      <p className={styles.formTitle}>{editing ? `Edit “${editing.title}”` : 'New season'}</p>
      <div className={styles.row2}>
        <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={fields.title} placeholder="Season 2 · Kairouan Clash" />
        <TextField label="Community XP goal" type="number" min={1000} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} error={fields.goal} />
      </div>
      <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={fields.description} />
      <div className={styles.row2}>
        <TextField label="Starts" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} error={fields.startsAt} />
        <TextField label="Ends" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} error={fields.endsAt} />
      </div>
      <fieldset className={styles.milestones}>
        <legend className="label">Pulse milestones</legend>
        {form.milestones.map((milestone, index) => (
          <div key={index} className={styles.milestoneRow}>
            <TextField label="At %" type="number" min={1} max={100} value={milestone.percent} onChange={(e) => setMilestone(index, { percent: e.target.value })} />
            <TextField label="Reward for everyone" value={milestone.reward} onChange={(e) => setMilestone(index, { reward: e.target.value })} placeholder="Profile frame: Sidi Bou Said" />
            <Button size="sm" variant="ghost" icon="trash" aria-label="Remove milestone" onClick={() => setForm({ ...form, milestones: form.milestones.filter((_, i) => i !== index) })} />
          </div>
        ))}
        {form.milestones.length < 10 ? (
          <Button size="sm" variant="outline" icon="plus" onClick={() => setForm({ ...form, milestones: [...form.milestones, { percent: '', reward: '' }] })}>
            Add milestone
          </Button>
        ) : null}
        {fields.milestones ? <p className={styles.error}>{fields.milestones}</p> : null}
      </fieldset>
      <FormError message={messageOf(save.error)} />
      <div className={styles.buttons}>
        <Button type="submit" icon={editing ? 'check' : 'plus'} loading={save.isPending}>
          {editing ? 'Save season' : 'Create season'}
        </Button>
        {editing ? (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const SEASON_TONE = { active: 'success', upcoming: 'primary', ended: 'muted' } as const;

function Seasons() {
  const seasons = useQuery({ queryKey: ['admin', 'seasons'], queryFn: api.admin.seasons });
  const [editing, setEditing] = useState<AdminSeason | null>(null);

  return (
    <Panel title="Seasons & Pulse" aside={<span className={styles.dim}>One season at a time; every XP point feeds its Pulse</span>}>
      {seasons.data ? (
        <ul className={styles.seasons}>
          {seasons.data.map((season) => (
            <li key={season.key} className={cx(styles.season, editing?.key === season.key && styles.rowEditing)}>
              <div className={styles.seasonHead}>
                <Tag tone={SEASON_TONE[season.status]}>{season.status}</Tag>
                <strong>{season.title}</strong>
                <span className={styles.dim}>
                  {formatDate(season.startsAt)} → {formatDate(season.endsAt)} · {formatNumber(season.contributors)} players
                </span>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(season)}>
                  Edit
                </Button>
              </div>
              <Meter value={Math.min(1, season.current / season.goal)} tone="gold" height={8} label={`${season.title} Pulse`} ticks={season.milestones.map((m) => m.percent / 100)} />
              <p className={styles.dim}>
                {formatNumber(season.current)} / {formatNumber(season.goal)} XP ·{' '}
                {season.milestones.map((m) => `${m.percent}% ${m.reached ? '✓' : ''} ${m.reward}`).join(' · ') || 'No milestones'}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Skeleton height={140} />
      )}
      <SeasonEditor key={editing?.key ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
    </Panel>
  );
}

/* ───────────── XP adjustments ───────────── */

function XpAdjustments() {
  const refresh = useRefresh('xp');
  const log = useQuery({ queryKey: ['admin', 'xp'], queryFn: api.admin.xpAdjustments });
  const [form, setForm] = useState({ username: '', amount: '', reason: '' });
  const adjust = useMutation({
    mutationFn: () => api.admin.adjustXp({ username: form.username.replace(/^@/, ''), amount: Number(form.amount), reason: form.reason }),
    onSuccess: () => (setForm({ username: '', amount: '', reason: '' }), refresh()),
  });
  const fields = fieldsOf(adjust.error);
  const amount = Number(form.amount);

  return (
    <Panel title="Adjust a player's XP" aside={<span className={styles.dim}>Shown in their XP history with your reason</span>}>
      <form className={styles.form} onSubmit={(event) => (event.preventDefault(), adjust.mutate())}>
        <div className={styles.row4}>
          <TextField label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} error={fields.username} placeholder="krat0_s" />
          <TextField
            label="XP (negative takes back)"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            error={fields.amount}
            placeholder="250 or -100"
          />
          <TextField label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={fields.reason} placeholder="Won the TG Hub community cup" />
          <div className={styles.alignEnd}>
            <Button type="submit" variant={amount < 0 ? 'danger' : 'primary'} loading={adjust.isPending} disabled={!form.username || !amount || !form.reason}>
              {amount < 0 ? `Take ${formatNumber(-amount)} XP` : amount > 0 ? `Give ${formatNumber(amount)} XP` : 'Apply'}
            </Button>
          </div>
        </div>
        <FormError message={messageOf(adjust.error)} />
        <p className={styles.dim}>Taking XP back never goes below zero; levels and the season score follow. The community Pulse keeps what it reached.</p>
      </form>

      {log.data ? (
        log.data.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th className={styles.num}>XP</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {log.data.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.cellTitle}>
                      {row.player.displayName}
                      <span className={styles.dim}> @{row.player.username}</span>
                    </td>
                    <td className={cx(styles.num, row.amount > 0 ? styles.gain : styles.loss)}>
                      {row.amount > 0 ? '+' : '−'}
                      {formatNumber(Math.abs(row.amount))}
                    </td>
                    <td>{row.reason}</td>
                    <td>{row.by ?? '—'}</td>
                    <td className={styles.cellTime}>
                      <RelativeTime iso={row.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.dim}>No adjustments yet.</p>
        )
      ) : (
        <Skeleton height={120} />
      )}
    </Panel>
  );
}

export function ProgressionAdmin() {
  return (
    <div className={styles.stackCol}>
      <Missions />
      <Achievements />
      <Seasons />
      <XpAdjustments />
    </div>
  );
}
