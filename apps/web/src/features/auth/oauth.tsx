import { cx } from '@/lib/cx';
import styles from './oauth.module.css';

/** Messages for the `auth_error` codes the API puts on its redirects. */
const OAUTH_ERRORS: Record<string, string> = {
  expired: 'That sign-in took too long — try again.',
  discord_denied: 'Discord sign-in was cancelled.',
  discord_email_missing: 'Your Discord account has no verified email. Verify it on Discord, or sign up with email instead.',
  discord_email_taken: 'An account already uses your Discord email. Sign in with your password, then connect Discord in Settings.',
  already_linked: 'That account is already linked to another TG Hub account.',
  suspended: 'This account is suspended.',
  not_configured: 'Discord sign-in isn’t available yet.',
  steam_failed: 'Steam couldn’t confirm the sign-in — try again.',
  failed: 'Something went wrong — try again.',
};

export function oauthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return OAUTH_ERRORS[code] ?? OAUTH_ERRORS.failed!;
}

export const discordStartUrl = (mode: 'login' | 'link', next: string) => `/api/v1/auth/discord/start?mode=${mode}&next=${encodeURIComponent(next)}`;
export const steamStartUrl = (next: string) => `/api/v1/auth/steam/start?next=${encodeURIComponent(next)}`;

/** Discord's mark (Simple Icons, CC0). Used only on "Continue with Discord" and the connection row. */
export function DiscordLogo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.1 14.1 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.956-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.42 0-1.332.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419Z" />
    </svg>
  );
}

/** Full navigation (not fetch): the flow continues on Discord's own pages. */
export function DiscordButton({ next, label = 'Continue with Discord', className }: { next: string; label?: string; className?: string }) {
  return (
    <a href={discordStartUrl('login', next)} className={cx(styles.discord, className)}>
      <DiscordLogo />
      {label}
    </a>
  );
}
