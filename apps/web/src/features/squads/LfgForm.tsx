'use client';

import {
  LFG_DURATIONS_HOURS,
  LFG_LANGUAGES,
  LFG_MAX_SLOTS,
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
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { LfgCard } from './LfgBoard';
import { SQUAD_KEYS, useGameOptions } from './shared';
import styles from './forms.module.css';

function Form({ me }: { me: Me }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const games = useGameOptions();
  const myClan = useQuery({ queryKey: SQUAD_KEYS.myClan, queryFn: api.clans.mine });
  // The preview counts its expiry from when the form was opened.
  const [openedAt] = useState(() => Date.now());
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
        mode: values.mode || t.lfg.modePreview,
        rank: values.rank,
        slots: values.slots,
        filled: 0,
        languages: values.languages,
        micRequired: values.micRequired,
        note: values.note,
        author: { id: me.id, username: me.username, displayName: me.displayName, avatarColor: me.avatarColor, avatarUrl: me.avatarUrl, level: me.level, country: me.country, clanTag: myClan.data?.clan?.tag ?? null },
        status: 'open',
        expiresAt: new Date(openedAt + values.durationHours * 3_600_000).toISOString(),
        createdAt: new Date(openedAt).toISOString(),
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
        {!me.emailVerified ? <VerifyEmailNotice text={t.lfg.verifyToPost} /> : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.lfg.theGame}</h2>
          <SelectField label={t.lfg.game} value={values.gameId} onChange={(e) => set('gameId', e.target.value)} error={fields.gameId} required>
            <option value="">{t.lfg.chooseGame}</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </SelectField>
          <div className={styles.group}>
            <span className={styles.groupLabel}>{t.lfg.platform}</span>
            <div className={styles.choices} role="radiogroup" aria-label={t.lfg.platform}>
              {PLATFORMS.map((platform) => (
                <button key={platform} type="button" role="radio" aria-checked={values.platform === platform} className={cx(styles.choice, values.platform === platform && styles.choiceOn)} onClick={() => set('platform', platform)}>
                  {t.labels.platform[platform]}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.row}>
            <TextField label={t.lfg.mode} placeholder={t.lfg.modePlaceholder} value={values.mode} maxLength={40} onChange={(e) => set('mode', e.target.value)} error={fields.mode} list="lfg-modes" required />
            <TextField label={t.lfg.rank} placeholder={t.lfg.rankPlaceholder} value={values.rank} maxLength={30} onChange={(e) => set('rank', e.target.value)} error={fields.rank} />
          </div>
          <datalist id="lfg-modes">
            {t.lfg.modeIdeas.map((mode) => (
              <option key={mode} value={mode} />
            ))}
          </datalist>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.lfg.lookingFor}</h2>
          <div className={styles.group}>
            <span className={styles.groupLabel}>{t.lfg.playersNeeded}</span>
            <div className={styles.stepper}>
              <button type="button" onClick={() => set('slots', Math.max(1, values.slots - 1))} disabled={values.slots <= 1} aria-label={t.lfg.fewer}>
                −
              </button>
              <output aria-live="polite">{values.slots}</output>
              <button type="button" onClick={() => set('slots', Math.min(LFG_MAX_SLOTS, values.slots + 1))} disabled={values.slots >= LFG_MAX_SLOTS} aria-label={t.lfg.more}>
                +
              </button>
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.groupLabel}>{t.lfg.voiceLanguages}</span>
            <div className={styles.choices}>
              {LFG_LANGUAGES.map((language) => (
                <button key={language} type="button" aria-pressed={values.languages.includes(language)} className={cx(styles.choice, values.languages.includes(language) && styles.choiceOn)} onClick={() => toggleLanguage(language)}>
                  {t.labels.lfgLanguage[language]}
                </button>
              ))}
            </div>
            {fields.languages ? <p className={styles.fieldError}>{fields.languages}</p> : null}
          </div>
          <Toggle label={t.lfg.micRequired} description={t.lfg.micRequiredHint} checked={values.micRequired} onChange={(on) => set('micRequired', on)} />
          <TextAreaField label={t.lfg.note} placeholder={t.lfg.notePlaceholder} value={values.note} maxLength={280} rows={3} onChange={(e) => set('note', e.target.value)} error={fields.note} hint={`${values.note.length}/280`} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.lfg.contactTiming}</h2>
          <TextField
            label={t.lfg.contactLabel}
            placeholder={t.lfg.contactPlaceholder}
            value={values.contact}
            maxLength={80}
            onChange={(e) => set('contact', e.target.value)}
            error={fields.contact}
            hint={t.lfg.contactHint}
            required
          />
          <div className={styles.group}>
            <span className={styles.groupLabel}>{t.lfg.staysUp}</span>
            <div className={styles.choices} role="radiogroup" aria-label={t.lfg.duration}>
              {LFG_DURATIONS_HOURS.map((hours) => (
                <button key={hours} type="button" role="radio" aria-checked={values.durationHours === hours} className={cx(styles.choice, values.durationHours === hours && styles.choiceOn)} onClick={() => set('durationHours', hours)}>
                  {t.lfg.durations[hours]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <FormError message={create.error && Object.keys(fields).length === 0 ? create.error.message : null} />
        <div className={styles.submit}>
          <Button variant="ghost" onClick={() => router.back()}>
            {t.common.cancel}
          </Button>
          <Button type="submit" loading={create.isPending} icon="send" disabled={!me.emailVerified}>
            {t.lfg.submit}
          </Button>
        </div>
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewTitle}>{t.lfg.preview}</p>
        {preview ? <LfgCard post={preview} /> : <p className={styles.previewNote}>{t.lfg.previewPick}</p>}
        <p className={styles.previewNote}>{t.lfg.previewNote}</p>
      </aside>
    </div>
  );
}

export function LfgForm() {
  const t = useT();
  return <SignedIn prompt={t.lfg.signInToPost}>{(me) => <Form me={me} />}</SignedIn>;
}
