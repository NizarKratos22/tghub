'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from './session';
import styles from './VerifyEmailBanner.module.css';

/** A reminder under the header until the sign-up code is confirmed. */
export function VerifyEmailBanner() {
  const t = useT();
  const { data: me } = useSession();
  const pathname = usePathname();
  if (!me || me.emailVerified || pathname === '/verify-email') return null;
  return (
    <div className={styles.banner} role="status">
      <div className={`container ${styles.inner}`}>
        <Icon name="message" size={17} />
        <span>{fill(t.auth.verifyBanner, { email: me.email })}</span>
        <Link href={`/verify-email?next=${encodeURIComponent(pathname)}`} className={styles.action}>
          {t.auth.enterCode}
        </Link>
      </div>
    </div>
  );
}

/** Inline gate for actions that need a confirmed email; `text` says what confirming unlocks. */
export function VerifyEmailNotice({ text }: { text?: string }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <div className={styles.notice}>
      <Icon name="lock" size={18} />
      <span>{text ?? t.auth.verifyNotice}</span>
      <Link href={`/verify-email?next=${encodeURIComponent(pathname)}`} className={styles.action}>
        {t.auth.enterCode}
      </Link>
    </div>
  );
}
