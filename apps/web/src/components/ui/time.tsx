'use client';

import { useEffect, useState } from 'react';
import { formatDateTime, relativeTime, timeLeft } from '@/lib/format';

/** Re-renders every `interval` ms so countdowns stay honest. */
function useNow(interval: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const now = useNow(60_000);
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className} suppressHydrationWarning>
      {relativeTime(iso, now)}
    </time>
  );
}

export function Countdown({ iso, prefix = 'Ends in', endedLabel = 'Ended', className }: { iso: string; prefix?: string; endedLabel?: string; className?: string }) {
  const now = useNow(30_000);
  const left = timeLeft(iso, now);
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className} suppressHydrationWarning>
      {left ? `${prefix} ${left}` : endedLabel}
    </time>
  );
}
