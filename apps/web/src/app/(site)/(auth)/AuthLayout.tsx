import type { GameSummary, Page } from '@tgh/shared';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { getT } from '@/i18n/server';
import { serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import styles from './auth.module.css';

const PERK_ICONS: IconName[] = ['star', 'cpu', 'store', 'bell'];

/** Box art for the drifting backdrop, split into columns that move at different speeds. */
async function coverColumns(): Promise<string[][]> {
  const games = await serverApiOr<Page<GameSummary> | null>('/games', null, { query: { pageSize: 18 }, revalidate: 600 });
  const covers = (games?.items ?? []).flatMap((game) => (game.coverUrl ? [game.coverUrl] : []));
  return [0, 1, 2].map((column) => covers.filter((_, index) => index % 3 === column));
}

/**
 * Sign-in, sign-up and account-recovery pages: a dark showcase of the games on
 * TG Hub beside the form. `mode` adds Sign in / Create account tabs that keep
 * the `next` redirect.
 */
export async function AuthLayout({
  kicker,
  title,
  mode,
  next,
  children,
}: {
  kicker: string;
  title: ReactNode;
  mode?: 'login' | 'register';
  next?: string;
  children: ReactNode;
}) {
  const [t, columns] = await Promise.all([getT(), coverColumns()]);
  const query = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <div className={`container ${styles.wrap}`}>
      <section className={styles.showcase}>
        <div className={styles.mosaic} aria-hidden>
          {columns.map((covers, index) =>
            covers.length > 0 ? (
              <div key={index} className={styles.column} style={{ '--drift': `${70 + index * 18}s` } as CSSProperties}>
                <div className={cx(styles.track, index === 1 && styles.reverse)}>
                  {[...covers, ...covers].map((src, i) => (
                    <img key={i} src={src} alt="" loading="lazy" decoding="async" />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
        <div className={styles.showcaseBody}>
          <Logo variant="primary" surface="dark" />
          <p className={styles.kicker}>{kicker}</p>
          <h1 className={styles.title}>{title}</h1>
          <ul className={styles.perks}>
            {t.auth.perks.map((perk, index) => (
              <li key={perk}>
                <span className={styles.perkIcon}>
                  <Icon name={PERK_ICONS[index] ?? 'check'} size={18} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.panel}>
        {mode ? (
          <>
            <nav className={styles.tabs} aria-label={t.auth.switchLabel}>
              <Link href={`/login${query}`} className={cx(styles.tab, mode === 'login' && styles.tabOn)} aria-current={mode === 'login' ? 'page' : undefined}>
                {t.auth.submitLogin}
              </Link>
              <Link href={`/register${query}`} className={cx(styles.tab, mode === 'register' && styles.tabOn)} aria-current={mode === 'register' ? 'page' : undefined}>
                {t.auth.submitRegister}
              </Link>
            </nav>
            <div className={styles.panelHead}>
              <h2>{mode === 'login' ? t.auth.panelLogin : t.auth.panelRegister}</h2>
              <p>{mode === 'login' ? t.auth.panelLoginText : t.auth.panelRegisterText}</p>
            </div>
          </>
        ) : null}
        {children}
      </section>
    </div>
  );
}
