'use client';

import {
  LFG_DURATIONS_HOURS,
  LFG_LANGUAGE_LABELS,
  LFG_LANGUAGES,
  LFG_MAX_SLOTS,
  PLATFORM_LABELS,
  PLATFORMS,
  type LfgLanguage,
  type LfgPost,
  type LfgPostInput,
  type Me,
  type Platform,
} from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { SignedIn } from '@/features/auth/session';
import { VerifyEmailNotice } from '@/features/auth/VerifyEmailBanner';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { LfgCard } from './LfgBoard';
import { SQUAD_KEYS, useGameOptions } from './shared';
import styles from './forms.module.css';

const DURATION_LABELS: Record<(typeof LFG_DURATIONS_HOURS)[number], string> = { 2: '2 hours', 6: '6 hours', 24: '1 day', 72: '3 days' };
const MODE_IDEAS = ['Ranked', 'Casual', 'Duo', 'Squad', 'Scrims', 'Roleplay'];

function Form({ me }: { me: Me }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const games = useGameOptions();
  const myClan = useQuery({ queryKey: SQUAD_KEYS.myClan, queryFn: api.clans.mine });
  const [values, setValues] = useState({
    gameId: '',
    platform: 'pc' as Platform,
    mode: '',
    rank: '',
    slots: 2,
    languages: ['ar'] as LfgLanguage[],
    micRequired: false,
    note: '',
    contact: '',
    durationHours: 6 as LfgPostInput['durationHours'],
  });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));

  const create = useMutation({
    mutationFn: () => api.lfg.create(values),
    onSuccess: (post) => {
      void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.lfg });
      router.push(`/squads/${post.id}`);
    },
  });
  const fields = create.error instanceof ApiError ? create.error.fields : {};

  const game = games.find((g) => g.id === values.gameId);
  const preview: LfgPost | null = game
    ? {
        id: 'preview',
        game,
        platform: values.platform,
        mode: values.mode || 'What you want to play',
        rank: values.rank,
        slots: values.slots,
        filled: 0,
        languages: values.languages,
        micRequired: values.micRequired,
        note: values.note,
        author: { id: me.id, username: me.username, displayName: me.displayName, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl, level: me.level, country: me.country, clanTag: myClan.data?.clan?.tag ?? null },
        status: 'open',
        expiresAt: new Date(Date.now() + values.durationHours * 3_600_000).toISOString(),
        createdAt: new Date().toISOString(),
        viewer: { isAuthor: true, request: null },
        contact: values.contact,
        pendingRequests: 0,
      }
    : null;

  const toggleLanguage = (language: LfgLanguage) =>
    set('languages', values.languages.includes(language) ? values.languages.filter((l) => l !== language) : [...values.languages, language]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className={styles.layout}>
      <form className={styles.form} onSubmit={onSubmit}>
        {!me.emailVerified ? <VerifyEmailNotice action="post in the teammate finder" /> : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The game</h2>
          <SelectField label="Game" value={values.gameId} onChange={(e) => set('gameId', e.target.value)} error={fields.gameId} required>
            <option value="">Choose a game…</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </SelectField>
          <div className={styles.group}>
            <span className={styles.groupLabel}>Platform</span>
            <div className={styles.choices} role="radiogroup" aria-label="Platform">
              {PLATFORMS.map((platform) => (
                <button key={platform} type="button" role="radio" aria-checked={values.platform === platform} className={cx(styles.choice, values.platform === platform && styles.choiceOn)} onClick={() => set('platform', platform)}>
                  {PLATFORM_LABELS[platform]}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.row}>
            <TextField label="Mode" placeholder="Ranked duo, Roleplay night…" value={values.mode} maxLength={40} onChange={(e) => set('mode', e.target.value)} error={fields.mode} list="lfg-modes" required />
            <TextField label="Rank (optional)" placeholder="Gold, Diamond 2, Level 120…" value={values.rank} maxLength={30} onChange={(e) => set('rank', e.target.value)} error={fields.rank} />
          </div>
          <datalist id="lfg-modes">
            {MODE_IDEAS.map((mode) => (
              <option key={mode} value={mode} />
            ))}
          </datalist>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Who you&rsquo;re looking for</h2>
          <div className={styles.group}>
            <span className={styles.groupLabel}>Players needed</span>
            <div className={styles.stepper}>
              <button type="button" onClick={() => set('slots', Math.max(1, values.slots - 1))} disabled={values.slots <= 1} aria-label="Fewer players">
                −
              </button>
              <output aria-live="polite">{values.slots}</output>
              <button type="button" onClick={() => set('slots', Math.min(LFG_MAX_SLOTS, values.slots + 1))} disabled={values.slots >= LFG_MAX_SLOTS} aria-label="More players">
                +
              </button>
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.groupLabel}>Languages on voice</span>
            <div className={styles.choices}>
              {LFG_LANGUAGES.map((language) => (
                <button key={language} type="button" aria-pressed={values.languages.includes(language)} className={cx(styles.choice, values.languages.includes(language) && styles.choiceOn)} onClick={() => toggleLanguage(language)}>
                  {LFG_LANGUAGE_LABELS[language]}
                </button>
              ))}
            </div>
            {fields.languages ? <p className={styles.fieldError}>{fields.languages}</p> : null}
          </div>
          <Toggle label="Mic required" description="Only players who can talk on voice." checked={values.micRequired} onChange={(on) => set('micRequired', on)} />
          <TextAreaField label="Note (optional)" placeholder="Playstyle, schedule, what you expect from teammates…" value={values.note} maxLength={280} rows={3} onChange={(e) => set('note', e.target.value)} error={fields.note} hint={`${values.note.length}/280`} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact and timing</h2>
          <TextField
            label="How accepted players reach you"
            placeholder="Discord name or in-game ID"
            value={values.contact}
            maxLength={80}
            onChange={(e) => set('contact', e.target.value)}
            error={fields.contact}
            hint="Only shown to players you accept."
            required
          />
          <div className={styles.group}>
            <span className={styles.groupLabel}>Post stays up for</span>
            <div className={styles.choices} role="radiogroup" aria-label="Duration">
              {LFG_DURATIONS_HOURS.map((hours) => (
                <button key={hours} type="button" role="radio" aria-checked={values.durationHours === hours} className={cx(styles.choice, values.durationHours === hours && styles.choiceOn)} onClick={() => set('durationHours', hours)}>
                  {DURATION_LABELS[hours]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <FormError message={create.error && Object.keys(fields).length === 0 ? create.error.message : null} />
        <div className={styles.submit}>
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} icon="send" disabled={!me.emailVerified}>
            Post squad
          </Button>
        </div>
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewTitle}>Preview</p>
        {preview ? <LfgCard post={preview} /> : <p className={styles.previewNote}>Pick a game to see how your post will look on the board.</p>}
        <p className={styles.previewNote}>Players ask to join; you accept who fits. Your contact is shared only with the players you accept.</p>
      </aside>
    </div>
  );
}

export function LfgForm() {
  return <SignedIn prompt="Sign in to post a squad">{(me) => <Form me={me} />}</SignedIn>;
}
