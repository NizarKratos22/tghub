import { useEffect, useState } from 'react';

/** Seconds left until `iso`, ticking every second — for resend timers. */
export function useSecondsUntil(iso: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0;
}
