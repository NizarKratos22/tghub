'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { AdminOverview, Me, Role } from '@tgh/shared';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Skeleton } from '@/components/ui/primitives';
import { useSession, useSignInHref, useSignOut } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { ADMIN_NAV, adminItemFor, canOpen } from './nav';
import styles from './AdminShell.module.css';

const STAFF: Role[] = ['admin', 'moderator'];

export const OVERVIEW_KEY = ['admin', 'overview'] as const;

function Gate({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className={styles.gate}>
      <div className={styles.gateCard}>
        <span className={styles.gateIcon}>
          <Icon name="shield" size={26} />
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
        <div className={styles.gateActions}>{children}</div>
      </div>
    </div>
  );
}

function Sidebar({ me, counts, onNavigate }: { me: Me; counts: AdminOverview | undefined; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = adminItemFor(pathname);
  const signOut = useSignOut();

  return (
    <div className={styles.sidebarInner}>
      <Link href="/admin" className={styles.brand} onClick={onNavigate}>
        <span className={styles.mark}>TG</span>
        <span className={styles.brandText}>
          HUB <span className={styles.brandTag}>Admin</span>
        </span>
      </Link>

      <nav className={styles.nav} aria-label="Admin">
        {ADMIN_NAV.map((group) => {
          const items = group.items.filter((item) => canOpen(item, me.role));
          if (items.length === 0) return null;
          return (
            <div key={group.title ?? 'main'} className={styles.group}>
              {group.title ? <p className={styles.groupTitle}>{group.title}</p> : null}
              {items.map((item) => {
                const count = item.badge && counts ? counts[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(styles.link, active?.href === item.href && styles.linkOn)}
                    aria-current={active?.href === item.href ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <Icon name={item.icon} size={18} />
                    <span className={styles.linkText}>{item.label}</span>
                    {count > 0 ? <span className={styles.count}>{count}</span> : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={styles.foot}>
        <Link href="/" className={styles.link}>
          <Icon name="arrowLeft" size={18} />
          <span className={styles.linkText}>Back to the site</span>
        </Link>
        <div className={styles.me}>
          <Avatar name={me.displayName} color={me.avatarColor} src={me.avatarUrl} size={34} />
          <span className={styles.meText}>
            <span className={styles.meName}>{me.displayName}</span>
            <span className={styles.meRole}>{me.role === 'admin' ? 'Administrator' : 'Moderator'}</span>
          </span>
          <button type="button" className={styles.iconButton} onClick={() => signOut.mutate()} aria-label="Sign out" title="Sign out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The dashboard frame: sidebar navigation, a slim top bar and a role gate.
 * The API enforces roles on every request; this only decides what to show.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const signInHref = useSignInHref();
  const { data: me, isPending } = useSession();
  const [drawer, setDrawer] = useState(false);
  const isAdmin = me?.role === 'admin';
  const overview = useQuery({ queryKey: OVERVIEW_KEY, queryFn: api.admin.overview, enabled: isAdmin, refetchInterval: 60_000 });
  const item = adminItemFor(pathname);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  // Moderators only have the marketplace queue; send them there instead of a page they can't use.
  const blocked = Boolean(me && item && !canOpen(item, me.role));
  useEffect(() => {
    if (me?.role === 'moderator' && blocked) router.replace('/admin/marketplace');
  }, [me?.role, blocked, router]);

  if (isPending) {
    return (
      <div className={styles.loading}>
        <Skeleton height={44} width={220} />
        <Skeleton height={320} />
      </div>
    );
  }
  if (!me) {
    return (
      <Gate title="Staff sign-in" text="The admin dashboard is for TG Hub administrators and moderators.">
        <ButtonLink href={signInHref}>Sign in</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Back to the site
        </ButtonLink>
      </Gate>
    );
  }
  if (!STAFF.includes(me.role)) {
    return (
      <Gate title="Staff only" text="Your account doesn't have access to the admin dashboard. Ask an administrator if you think it should.">
        <ButtonLink href="/">Back to the site</ButtonLink>
      </Gate>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={cx(styles.sidebar, drawer && styles.sidebarOpen)} aria-label="Admin navigation">
        <Sidebar me={me} counts={overview.data} onNavigate={() => setDrawer(false)} />
      </aside>
      {drawer ? <button type="button" className={styles.scrim} aria-label="Close menu" onClick={() => setDrawer(false)} /> : null}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={cx(styles.iconButton, styles.menuButton)} onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}>
            <Icon name="menu" size={20} />
          </button>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            {item && item.href !== '/admin' ? (
              <>
                <Icon name="chevronRight" size={14} />
                <span>{item.label}</span>
              </>
            ) : null}
          </nav>
          <div className={styles.tools}>
            {isAdmin && overview.data && overview.data.flaggedListings > 0 ? (
              <Link href="/admin/marketplace" className={styles.alertPill}>
                <Icon name="flag" size={14} />
                {overview.data.flaggedListings} to review
              </Link>
            ) : null}
            <ThemeToggle />
            <ButtonLink href="/" variant="outline" size="sm" iconRight="external" className={styles.viewSite}>
              View site
            </ButtonLink>
          </div>
        </header>
        <div className={styles.content}>{blocked ? <Skeleton height={240} /> : children}</div>
      </div>
    </div>
  );
}

/** Heading block at the top of each admin page. */
export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageText}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </div>
  );
}
