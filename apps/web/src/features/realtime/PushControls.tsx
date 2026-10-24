'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { useT } from '@/i18n/I18nProvider';
import { ApiError } from '@/lib/api/client';
import { currentPushState, disablePush, enablePush, type PushState } from './push';
import styles from './PushControls.module.css';

const PROMPT_DISMISSED_KEY = 'tgh-push-prompt-dismissed';

const DESCRIPTIONS: Record<PushState, string> = {
  on: "On for this device. Chats, level-ups and alerts reach you while TG Hub isn't open.",
  off: 'Get chat messages, level-ups and alerts on this device, even when TG Hub is closed.',
  denied: 'Blocked in this browser. Allow notifications for this site in its settings, then come back.',
  'needs-install': 'On iPhone and iPad: tap Share → Add to Home Screen, open TG Hub from there, then turn this on.',
  unsupported: "This browser can't show notifications.",
  unavailable: 'Not available on this server yet.',
};

export function usePush() {
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
      setError(failure instanceof ApiError ? failure.message : "Couldn't change notifications on this device — try again");
      setState(await currentPushState());
    } finally {
      setBusy(false);
    }
  };
  return { state, busy, error, set };
}

/** The settings switch for this browser's notifications. */
export function PushToggle() {
  const { state, busy, error, set } = usePush();
  if (!state) return null;
  const blocked = state !== 'on' && state !== 'off';
  return (
    <div className={styles.toggle}>
      <Toggle label="Notifications on this device" description={DESCRIPTIONS[state]} checked={state === 'on'} disabled={busy || blocked} onChange={(on) => void set(on)} />
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
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(PROMPT_DISMISSED_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

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
