'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DiscordLogo } from '@/features/auth/oauth';
import { useT } from '@/i18n/I18nProvider';
import { copyText } from '@/lib/clipboard';

/** The Discord username a player shares on their profile; one tap copies it to add them on Discord. */
export function DiscordUsername({ username, className }: { username: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const label = `${t.profile.copyDiscord}: ${username}`;

  const copy = async () => {
    if (!(await copyText(username))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <button type="button" className={className} onClick={() => void copy()} title={label} aria-label={label}>
        <DiscordLogo size={14} />
        <bdi dir="ltr">{username}</bdi>
        <Icon name={copied ? 'check' : 'link'} size={12} />
      </button>
      {/* Outside the button: screen readers ignore live regions inside controls. */}
      <span className="visually-hidden" role="status">
        {copied ? t.profile.discordCopied : ''}
      </span>
    </>
  );
}
