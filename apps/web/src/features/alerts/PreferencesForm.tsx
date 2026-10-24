'use client';

import { ALERT_CATEGORIES, ALERT_CATEGORY_META, type AlertPreferences } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/primitives';
import { Toggle } from '@/components/ui/Toggle';
import { SignedIn } from '@/features/auth/session';
import { PushToggle } from '@/features/realtime/PushControls';
import { api } from '@/lib/api/client';
import styles from './PreferencesForm.module.css';

const PREFS_KEY = ['alerts', 'preferences'] as const;

function Form({ initial }: { initial: AlertPreferences }) {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const games = useQuery({ queryKey: ['games', 'all'], queryFn: () => api.games.list({ pageSize: 48, sort: 'title' }), staleTime: 10 * 60_000 });

  useEffect(() => setPrefs(initial), [initial]);

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
        <h2 className={styles.heading}>Categories</h2>
        {ALERT_CATEGORIES.map((category) => (
          <Toggle
            key={category}
            label={ALERT_CATEGORY_META[category].label}
            description={ALERT_CATEGORY_META[category].description}
            checked={prefs.categories[category]}
            onChange={(checked) => setPrefs((p) => ({ ...p, categories: { ...p.categories, [category]: checked } }))}
          />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Games</h2>
        <Toggle
          label="Every game"
          description="Get update alerts for the whole catalogue, not just the games you follow. Noisy."
          checked={prefs.followAllGames}
          onChange={(checked) => setPrefs((p) => ({ ...p, followAllGames: checked }))}
        />
        <div className={styles.games}>
          <p className={styles.subLabel}>Following · {followed.length}</p>
          {followed.length > 0 ? (
            <ul className={styles.chips}>
              {followed.map((game) => (
                <li key={game.id}>
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => setPrefs((p) => ({ ...p, followedGameIds: p.followedGameIds.filter((id) => id !== game.id) }))}
                    aria-label={`Unfollow ${game.title}`}
                  >
                    <span style={{ background: game.accent }} className={styles.chipDot} />
                    {game.title}
                    <Icon name="close" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Not following any games yet. Favouriting a game follows it automatically.</p>
          )}
          <select
            className={styles.add}
            value=""
            onChange={(event) => event.target.value && setPrefs((p) => ({ ...p, followedGameIds: [...p.followedGameIds, event.target.value] }))}
            aria-label="Follow another game"
          >
            <option value="">+ Follow another game…</option>
            {available.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </div>

        <h2 className={styles.heading}>Frequency</h2>
        <div className={styles.cap}>
          <label htmlFor="cap" className={styles.capLabel}>
            Daily limit
            <span className={styles.capValue}>{prefs.maxPerDay}</span>
          </label>
          <input id="cap" type="range" min={1} max={50} value={prefs.maxPerDay} onChange={(event) => setPrefs((p) => ({ ...p, maxPerDay: Number(event.target.value) }))} />
          <p className={styles.muted}>Maximum broadcast alerts per day. Your own activity (level-ups, achievements) is never capped.</p>
        </div>

        <div className={styles.channels}>
          <p className={styles.subLabel}>Delivery</p>
          <p>
            <strong>Inbox</strong> — on, always.
          </p>
          <p>
            <strong>Discord</strong> — server admins choose which categories post to their channels.
          </p>
        </div>
        <PushToggle />
      </section>

      <div className={styles.bar}>
        <FormError message={save.error?.message} />
        <span className={styles.saved}>{savedAt && !dirty ? 'Saved' : dirty ? 'Unsaved changes' : ''}</span>
        <Button onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending} icon="check">
          Save preferences
        </Button>
      </div>
    </div>
  );
}

export function PreferencesForm() {
  return (
    <SignedIn prompt="Sign in to choose your alerts">
      {() => <PreferencesLoader />}
    </SignedIn>
  );
}

function PreferencesLoader() {
  const prefs = useQuery({ queryKey: PREFS_KEY, queryFn: api.alerts.preferences });
  if (!prefs.data) return <Skeleton height={420} />;
  return <Form initial={prefs.data} />;
}
