'use client';

import { useEffect, useState } from 'react';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';

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
  const format = useFormat();
  return (
    <time dateTime={iso} title={format.dateTime(iso)} className={className} suppressHydrationWarning>
      {format.relative(iso, now)}
    </time>
  );
}

/** `label` is a template with `{time}` — "Ends in {time}" — so each language can place the time where it reads naturally. */
export function Countdown({ iso, label, endedLabel, className }: { iso: string; label?: string; endedLabel?: string; className?: string }) {
  const now = useNow(30_000);
  const t = useT();
  const format = useFormat();
  const left = format.timeLeft(iso, now);
  return (
    <time dateTime={iso} title={format.dateTime(iso)} className={className} suppressHydrationWarning>
      {left ? fill(label ?? t.time.endsIn, { time: left }) : (endedLabel ?? t.time.ended)}
    </time>
  );
}
