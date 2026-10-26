import type { Page, Resource } from '@tgh/shared';
import { getT } from '@/i18n/server';
import { serverApiOr } from '@/lib/api/server';
import { HeaderShell } from './HeaderShell';
import { Logo } from './Logo';
import { MainNav } from './MainNav';
import { Ticker } from './Ticker';
import styles from './SiteHeader.module.css';

export async function SiteHeader() {
  const t = await getT();
  const ticker = await serverApiOr<Page<Resource> | null>('/radar', null, {
    query: { active: true, pageSize: 10 },
    revalidate: 120,
  });

  return (
    <>
      <a href="#main" className={styles.skip}>
        {t.common.skipToContent}
      </a>
      {ticker && ticker.items.length > 0 ? <Ticker items={ticker.items} /> : null}
      <HeaderShell className={styles.header} liftedClassName={styles.lifted}>
        <div className={`container ${styles.inner}`}>
          <Logo />
          <MainNav />
        </div>
      </HeaderShell>
    </>
  );
}
