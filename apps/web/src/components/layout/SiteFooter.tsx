import Link from 'next/link';
import { getT } from '@/i18n/server';
import { LanguageSwitch } from './LanguageSwitch';
import { PoweredByDefendr } from './Defendr';
import { Logo } from './Logo';
import styles from './SiteFooter.module.css';

export async function SiteFooter() {
  const t = await getT();
  const columns = [
    {
      title: t.footer.explore,
      links: [
        { href: '/radar', label: t.nav.radar },
        { href: '/games', label: t.footer.catalogue },
        { href: '/guides', label: t.nav.guides },
        { href: '/tournaments', label: t.nav.tournaments },
        { href: '/squads', label: t.footer.findTeammates },
        { href: '/clans', label: t.footer.clans },
        { href: '/market', label: t.nav.market },
        { href: '/pc', label: t.nav.pc },
        { href: '/universe', label: t.nav.universe },
      ],
    },
    {
      title: t.footer.account,
      links: [
        { href: '/register', label: t.footer.createAccount },
        { href: '/market/sell', label: t.footer.sell },
        { href: '/market/inbox', label: t.nav.messages },
        { href: '/alerts', label: t.footer.alertsInbox },
        { href: '/alerts/preferences', label: t.account.alertPrefs },
        { href: '/settings', label: t.account.settings },
      ],
    },
  ];

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.brand}>
          <Logo variant="primary" surface="dark" />
          <p>{t.footer.tagline}</p>
          <PoweredByDefendr label={t.footer.poweredBy} />
          <LanguageSwitch tone="dark" />
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className={styles.heading}>{column.title}</p>
            <ul className={styles.links}>
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className={styles.heading}>{t.footer.comingNext}</p>
          <ul className={styles.roadmap}>
            {t.footer.roadmap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`container ${styles.base}`}>
        <span>
          © {new Date().getFullYear()} TG Hub · {t.footer.rights}
        </span>
        <span>{t.footer.disclaimer}</span>
        <span>
          {t.footer.gameData}{' '}
          <a href="https://www.igdb.com" target="_blank" rel="noreferrer">
            IGDB.com
          </a>
        </span>
      </div>
    </footer>
  );
}
