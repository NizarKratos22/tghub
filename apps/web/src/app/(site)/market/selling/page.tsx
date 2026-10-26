import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { ButtonLink } from '@/components/ui/Button';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { SellingDashboard } from '@/features/market/Selling';
import styles from '../market.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.selling.title };
}

export default async function SellingPage() {
  const t = await getT();
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/selling" collapseOnMobile />
      <section className={`${styles.main} ${styles.mainNarrow}`} aria-labelledby="selling-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="selling-heading">{t.selling.title}</h2>
            <p className={styles.meta}>{t.selling.lede}</p>
          </div>
          <ButtonLink href="/market/sell" icon="plus" size="sm">
            {t.selling.newListing}
          </ButtonLink>
        </div>
        <SellingDashboard />
      </section>
    </div>
  );
}
