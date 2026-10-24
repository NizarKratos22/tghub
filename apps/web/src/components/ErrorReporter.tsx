'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/report-error';

/** Catches errors React's boundaries never see: event handlers, timers, rejected promises. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Cross-origin scripts (extensions, ads) only say "Script error." — nothing to act on.
      if (!event.error && event.message === 'Script error.') return;
      reportError(event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
