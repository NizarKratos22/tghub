import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { NewListing } from '@/features/market/SellGate';
import styles from '../market.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.sell.metaTitle };
}

export default async function SellPage() {
  const t = await getT();
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/sell" collapseOnMobile />
      <section className={`${styles.main} ${styles.mainNarrow}`} aria-labelledby="sell-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="sell-heading">{t.sell.title}</h2>
            <p className={styles.meta}>{t.sell.lede}</p>
          </div>
        </div>
        <NewListing />
      </section>
    </div>
  );
}
