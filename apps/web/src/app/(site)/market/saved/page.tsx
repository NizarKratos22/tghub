import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { SavedListings } from '@/features/market/Selling';
import styles from '../market.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.selling.savedTitle };
}

export default async function SavedPage() {
  const t = await getT();
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/saved" collapseOnMobile />
      <section className={styles.main} aria-labelledby="saved-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="saved-heading">{t.selling.savedTitle}</h2>
            <p className={styles.meta}>{t.selling.savedLede}</p>
          </div>
        </div>
        <SavedListings />
      </section>
    </div>
  );
}
