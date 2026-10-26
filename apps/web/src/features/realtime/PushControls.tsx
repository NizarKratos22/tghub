'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { useT } from '@/i18n/I18nProvider';
import { ApiError } from '@/lib/api/client';
import { currentPushState, disablePush, enablePush, type PushState } from './push';
import styles from './PushControls.module.css';

const PROMPT_DISMISSED_KEY = 'tgh-push-prompt-dismissed';
const neverChanges = () => () => {};
const readDismissed = () => {
  try {
    return localStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};
// Hidden in the server render, so it never flashes before the stored answer is known.
const serverDismissed = () => true;

export function usePush() {
  const t = useT();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void currentPushState().then(setState);
  }, []);

  const set = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setState(await (on ? enablePush() : disablePush()));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : t.alerts.pushFailed);
      setState(await currentPushState());
    } finally {
      setBusy(false);
    }
  };
  return { state, busy, error, set };
}

/** The settings switch for this browser's notifications. */
export function PushToggle() {
  const t = useT();
  const { state, busy, error, set } = usePush();
  if (!state) return null;
  const blocked = state !== 'on' && state !== 'off';
  return (
    <div className={styles.toggle}>
      <Toggle label={t.alerts.pushLabel} description={t.alerts.push[state]} checked={state === 'on'} disabled={busy || blocked} onChange={(on) => void set(on)} />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One-time nudge at the top of the bell dropdown, until it's turned on or dismissed. */
export function PushPrompt() {
  const t = useT();
  const { state, busy, error, set } = usePush();
  const dismissedBefore = useSyncExternalStore(neverChanges, readDismissed, serverDismissed);
  const [dismissedNow, setDismissed] = useState(false);
  const dismissed = dismissedBefore || dismissedNow;

  if (state !== 'off' || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
    } catch {
      // Private mode: it shows again next visit, which is fine.
    }
  };

  return (
    <div className={styles.prompt}>
      <span className={styles.promptIcon}>
        <Icon name="bell" size={18} />
      </span>
      <div className={styles.promptText}>
        <strong>{t.live.pushTitle}</strong>
        <span>{t.live.pushText}</span>
        {error ? <span className={styles.error}>{error}</span> : null}
        <div className={styles.promptActions}>
          <button type="button" className={styles.promptOn} onClick={() => void set(true)} disabled={busy}>
            {busy ? t.live.pushTurningOn : t.live.pushOn}
          </button>
          <button type="button" className={styles.promptLater} onClick={dismiss}>
            {t.live.pushLater}
          </button>
        </div>
      </div>
    </div>
  );
}
