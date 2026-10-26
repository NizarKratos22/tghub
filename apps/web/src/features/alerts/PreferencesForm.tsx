'use client';

import { ALERT_CATEGORIES, type AlertPreferences } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/primitives';
import { Toggle } from '@/components/ui/Toggle';
import { SignedIn } from '@/features/auth/session';
import { PushToggle } from '@/features/realtime/PushControls';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import styles from './PreferencesForm.module.css';

const PREFS_KEY = ['alerts', 'preferences'] as const;

function Form({ initial }: { initial: AlertPreferences }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const games = useQuery({ queryKey: ['games', 'all'], queryFn: () => api.games.list({ pageSize: 48, sort: 'title' }), staleTime: 10 * 60_000 });

  // A fresh copy from the server (after a save, or from another tab) replaces the form.
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setPrefs(initial);
  }

  const save = useMutation({
    mutationFn: () => api.alerts.updatePreferences(prefs),
    onSuccess: (updated) => {
      queryClient.setQueryData(PREFS_KEY, updated);
      setSavedAt(Date.now());
    },
  });

  const allGames = games.data?.items ?? [];
  const followed = allGames.filter((game) => prefs.followedGameIds.includes(game.id));
  const available = allGames.filter((game) => !prefs.followedGameIds.includes(game.id));
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  return (
    <div className={styles.layout}>
      <section className={styles.section}>
        <h2 className={styles.heading}>{t.alerts.categories}</h2>
        {ALERT_CATEGORIES.map((category) => (
          <Toggle
            key={category}
            label={t.labels.alertCategory[category].label}
            description={t.labels.alertCategory[category].description}
            checked={prefs.categories[category]}
            onChange={(checked) => setPrefs((p) => ({ ...p, categories: { ...p.categories, [category]: checked } }))}
          />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t.alerts.games}</h2>
        <Toggle
          label={t.alerts.everyGame}
          description={t.alerts.everyGameHint}
          checked={prefs.followAllGames}
          onChange={(checked) => setPrefs((p) => ({ ...p, followAllGames: checked }))}
        />
        <div className={styles.games}>
          <p className={styles.subLabel}>{fill(t.alerts.followingCount, { count: followed.length })}</p>
          {followed.length > 0 ? (
            <ul className={styles.chips}>
              {followed.map((game) => (
                <li key={game.id}>
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => setPrefs((p) => ({ ...p, followedGameIds: p.followedGameIds.filter((id) => id !== game.id) }))}
                    aria-label={fill(t.alerts.unfollowGame, { game: game.title })}
                  >
                    <span style={{ background: game.accent }} className={styles.chipDot} />
                    {game.title}
                    <Icon name="close" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{t.alerts.notFollowing}</p>
          )}
          <select
            className={styles.add}
            value=""
            onChange={(event) => event.target.value && setPrefs((p) => ({ ...p, followedGameIds: [...p.followedGameIds, event.target.value] }))}
            aria-label={t.alerts.followAnother}
          >
            <option value="">{t.alerts.followAnotherOption}</option>
            {available.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </div>

        <h2 className={styles.heading}>{t.alerts.frequency}</h2>
        <div className={styles.cap}>
          <label htmlFor="cap" className={styles.capLabel}>
            {t.alerts.dailyLimit}
            <span className={styles.capValue}>{prefs.maxPerDay}</span>
          </label>
          <input id="cap" type="range" min={1} max={50} value={prefs.maxPerDay} onChange={(event) => setPrefs((p) => ({ ...p, maxPerDay: Number(event.target.value) }))} />
          <p className={styles.muted}>{t.alerts.dailyLimitHint}</p>
        </div>

        <div className={styles.channels}>
          <p className={styles.subLabel}>{t.alerts.delivery}</p>
          <p>
            <strong>{t.alerts.inbox}</strong> {t.alerts.inboxText}
          </p>
          <p>
            <strong>{t.alerts.discord}</strong> {t.alerts.discordText}
          </p>
        </div>
        <PushToggle />
      </section>

      <div className={styles.bar}>
        <FormError message={save.error?.message} />
        <span className={styles.saved}>{savedAt && !dirty ? t.alerts.saved : dirty ? t.alerts.unsaved : ''}</span>
        <Button onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending} icon="check">
          {t.alerts.save}
        </Button>
      </div>
    </div>
  );
}

export function PreferencesForm() {
  const t = useT();
  return (
    <SignedIn prompt={t.alerts.signInPrefs}>
      {() => <PreferencesLoader />}
    </SignedIn>
  );
}

function PreferencesLoader() {
  const prefs = useQuery({ queryKey: PREFS_KEY, queryFn: api.alerts.preferences });
  if (!prefs.data) return <Skeleton height={420} />;
  return <Form initial={prefs.data} />;
}
