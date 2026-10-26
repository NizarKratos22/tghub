'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { reportError } from '@/lib/report-error';
import styles from '../status.module.css';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => reportError(error), [error]);
  return (
    <div className={`container ${styles.wrap}`}>
      <p className={styles.code}>ERR / 500</p>
      <h1 className={styles.title}>{t.errors.serverTitle}</h1>
      <p className={styles.text}>{t.errors.serverText}</p>
      {error.digest ? <p className={styles.digest}>{fill(t.errors.ref, { digest: error.digest })}</p> : null}
      <div className={styles.actions}>
        <Button onClick={reset} icon="refresh">
          {t.errors.tryAgain}
        </Button>
        <ButtonLink href="/" variant="outline">
          {t.errors.home}
        </ButtonLink>
      </div>
    </div>
  );
}
