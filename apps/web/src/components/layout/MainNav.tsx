'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { NotificationsMenu } from '@/features/alerts/NotificationsMenu';
import { useSession, useSignInHref, useSignOut } from '@/features/auth/session';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { titleName } from '@/i18n/places';
import { cx } from '@/lib/cx';
import { useOpenForRoute } from '@/lib/useOpenForRoute';
import { QuickSearch } from '@/features/search/QuickSearch';
import { LanguageSwitch } from './LanguageSwitch';
import { NAV_LINKS } from './nav-links';
import { ThemeToggle } from './ThemeToggle';
import styles from './MainNav.module.css';

function countLabel(count: number) {
  return count > 99 ? '99+' : String(count);
}

function AccountMenu() {
  const t = useT();
  const { data: me } = useSession();
  const signOut = useSignOut();
  const [open, setOpen] = useOpenForRoute();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open, setOpen]);

  if (!me) return null;

  return (
    <div className={styles.account} ref={ref}>
      <button type="button" className={styles.accountButton} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <Avatar name={me.displayName} color={me.avatarColor} src={me.avatarUrl} size={32} />
        <span className={styles.accountText}>
          <span className={styles.accountName}>{me.displayName}</span>
          <span className={styles.accountLevel}>{fill(t.common.level, { level: me.level })}</span>
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHead}>
            <Avatar name={me.displayName} color={me.avatarColor} src={me.avatarUrl} size={40} />
            <div>
              <p className={styles.menuName}>{me.displayName}</p>
              <p className={styles.menuMeta}>
                {fill(t.common.levelShort, { level: me.level })} · {titleName(me.title, t)}
              </p>
            </div>
          </div>
          <Link href="/feed" role="menuitem" className={styles.menuItem}>
            <Icon name="users" size={18} /> {t.account.feed}
          </Link>
          <Link href={`/u/${me.username}`} role="menuitem" className={styles.menuItem}>
            <Icon name="user" size={18} /> {t.account.profile}
          </Link>
          <Link href="/market/selling" role="menuitem" className={styles.menuItem}>
            <Icon name="tag" size={18} /> {t.account.listings}
          </Link>
          <Link href="/market/saved" role="menuitem" className={styles.menuItem}>
            <Icon name="heart" size={18} /> {t.account.saved}
          </Link>
          <Link href="/universe" role="menuitem" className={styles.menuItem}>
            <Icon name="trophy" size={18} /> {t.account.missions}
          </Link>
          <Link href="/alerts/preferences" role="menuitem" className={styles.menuItem}>
            <Icon name="bell" size={18} /> {t.account.alertPrefs}
          </Link>
          <Link href="/settings" role="menuitem" className={styles.menuItem}>
            <Icon name="settings" size={18} /> {t.account.settings}
          </Link>
          {me.role === 'admin' ? (
            <Link href="/admin" role="menuitem" className={styles.menuItem}>
              <Icon name="shield" size={18} /> {t.account.admin}
            </Link>
          ) : null}
          <div className={styles.menuRule} />
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => signOut.mutate()}>
            <Icon name="logout" size={18} /> {t.common.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Portalled to <body> so no ancestor's stacking context can clip the fixed panel. */
function MobileDrawer({
  top,
  isActive,
  counts,
  signInHref,
}: {
  top: number;
  isActive: (href: string, also?: string[]) => boolean;
  /** null for guests. */
  counts: { alerts: number; messages: number } | null;
  signInHref: string;
}) {
  const t = useT();
  return createPortal(
    <div className={styles.drawer} style={{ top }}>
      <nav aria-label={t.nav.mobileNav} className={styles.drawerNav}>
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={cx(styles.drawerLink, isActive(link.href, link.also) && styles.drawerActive)}>
            <span className={styles.drawerIcon}>
              <Icon name={link.icon} size={20} />
            </span>
            {t.nav[link.label]}
            <Icon name="chevronRight" size={18} className={styles.drawerChevron} />
          </Link>
        ))}
        {counts ? (
          <>
            <Link href="/feed" className={cx(styles.drawerLink, isActive('/feed') && styles.drawerActive)}>
              <span className={styles.drawerIcon}>
                <Icon name="users" size={20} />
              </span>
              {t.nav.feed}
              <Icon name="chevronRight" size={18} className={styles.drawerChevron} />
            </Link>
            <Link href="/market/inbox" className={cx(styles.drawerLink, isActive('/market/inbox') && styles.drawerActive)}>
              <span className={styles.drawerIcon}>
                <Icon name="message" size={20} />
              </span>
              {t.nav.messages}
              {counts.messages > 0 ? <span className={styles.drawerCount}>{countLabel(counts.messages)}</span> : null}
              <Icon name="chevronRight" size={18} className={styles.drawerChevron} />
            </Link>
            <Link href="/alerts" className={cx(styles.drawerLink, isActive('/alerts') && styles.drawerActive)}>
              <span className={styles.drawerIcon}>
                <Icon name="bell" size={20} />
              </span>
              {t.nav.alerts}
              {counts.alerts > 0 ? <span className={styles.drawerCount}>{countLabel(counts.alerts)}</span> : null}
              <Icon name="chevronRight" size={18} className={styles.drawerChevron} />
            </Link>
          </>
        ) : null}
      </nav>
      <div className={styles.drawerTheme}>
        <span>{t.common.theme}</span>
        <ThemeToggle />
      </div>
      <div className={styles.drawerTheme}>
        <span>{t.common.language}</span>
        <LanguageSwitch />
      </div>
      {counts === null ? (
        <div className={styles.drawerActions}>
          <ButtonLink href={signInHref} variant="outline" block>
            {t.common.signIn}
          </ButtonLink>
          <ButtonLink href="/register" block>
            {t.common.signUp}
          </ButtonLink>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

export function MainNav() {
  const t = useT();
  const pathname = usePathname();
  const { data: me, isPending } = useSession();
  const signInHref = useSignInHref();
  const [drawer, setDrawer] = useOpenForRoute();
  const [drawerTop, setDrawerTop] = useState(0);

  const toggleDrawer = () => {
    // The sticky header sits lower while the ticker is still on screen.
    setDrawerTop(document.querySelector('header')?.getBoundingClientRect().bottom ?? 0);
    setDrawer((open) => !open);
  };
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  const isActive = (href: string, also: string[] = []) => [href, ...also].some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const navRef = useRef<HTMLElement>(null);
  const [pointed, setPointed] = useState<HTMLElement | null>(null);
  const [bar, setBar] = useState<{ x: number; width: number; resting: boolean } | null>(null);
  const placeBar = useCallback(() => {
    const target = pointed ?? navRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? null;
    if (!target) return setBar((current) => (current ? { ...current, width: 0 } : null));
    // offsetLeft is measured from the nav's left edge in both reading directions; the bar spans the text, inside the link's padding.
    const pad = parseFloat(getComputedStyle(target).paddingLeft) || 12;
    setBar({ x: target.offsetLeft + pad, width: target.offsetWidth - pad * 2, resting: target.getAttribute('aria-current') === 'page' });
  }, [pointed]);
  useLayoutEffect(placeBar, [placeBar, pathname]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(placeBar);
    observer.observe(nav);
    void document.fonts?.ready.then(placeBar);
    return () => observer.disconnect();
  }, [placeBar]);
  const pointAt = (event: { target: EventTarget }) => setPointed((event.target as HTMLElement).closest('a'));

  return (
    <>
      <nav
        ref={navRef}
        className={cx(styles.primary, bar && styles.barReady)}
        aria-label={t.nav.mainNav}
        onMouseOver={pointAt}
        onFocus={pointAt}
        onMouseLeave={() => setPointed(null)}
        onBlur={() => setPointed(null)}
      >
        <span
          className={cx(styles.bar, bar?.resting === false && styles.barPointing)}
          style={bar ? { transform: `translateX(${bar.x}px)`, width: bar.width } : undefined}
          aria-hidden
        />
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cx(styles.link, isActive(link.href, link.also) && styles.active)}
            aria-current={isActive(link.href, link.also) ? 'page' : undefined}
          >
            {t.nav[link.label]}
          </Link>
        ))}
      </nav>

      <div className={styles.tools}>
        <QuickSearch />
        <ThemeToggle className={styles.wideOnly} />
        {me ? (
          <>
            <Link href="/feed" className={cx(styles.iconButton, styles.wideOnly, isActive('/feed') && styles.iconActive)} aria-label={t.nav.feed} title={t.nav.feed}>
              <Icon name="users" size={19} />
            </Link>
            <Link
              href="/market/inbox"
              className={cx(styles.iconButton, styles.narrowHide, isActive('/market/inbox') && styles.iconActive)}
              aria-label={fill(t.nav.messagesUnread, { count: me.marketUnread })}
            >
              <Icon name="message" size={19} />
              {me.marketUnread > 0 ? <span className={styles.badge}>{countLabel(me.marketUnread)}</span> : null}
            </Link>
            <NotificationsMenu unread={me.unreadCount} className={styles.iconButton} activeClassName={styles.iconActive} badgeClassName={styles.badge} />
            <AccountMenu />
          </>
        ) : isPending ? (
          <span className={styles.placeholder} aria-hidden />
        ) : (
          <div className={styles.guest}>
            <ButtonLink href={signInHref} variant="outline" size="sm" className={styles.signIn}>
              {t.common.signIn}
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              {t.common.signUp}
            </ButtonLink>
          </div>
        )}
        <button type="button" className={cx(styles.iconButton, styles.menuToggle)} aria-label={drawer ? t.common.closeMenu : t.common.openMenu} aria-expanded={drawer} onClick={toggleDrawer}>
          <Icon name={drawer ? 'close' : 'menu'} size={22} />
          {me && me.marketUnread > 0 && !drawer ? <span className={styles.menuDot} aria-hidden /> : null}
        </button>
      </div>

      {drawer ? (
        <MobileDrawer
          top={drawerTop}
          isActive={isActive}
          counts={me ? { alerts: me.unreadCount, messages: me.marketUnread } : null}
          signInHref={signInHref}
        />
      ) : null}
    </>
  );
}
