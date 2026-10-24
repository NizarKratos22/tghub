'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { reportError } from '@/lib/report-error';
import styles from '../status.module.css';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <div className={`container ${styles.wrap}`}>
      <p className={styles.code}>ERR / 500</p>
      <h1 className={styles.title}>Signal lost</h1>
      <p className={styles.text}>
        We couldn&apos;t load this page. If you&apos;re running TG Hub locally, check that the API is up on port 4000.
      </p>
      {error.digest ? <p className={styles.digest}>Ref {error.digest}</p> : null}
      <div className={styles.actions}>
        <Button onClick={reset} icon="refresh">
          Try again
        </Button>
        <ButtonLink href="/" variant="outline">
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}
