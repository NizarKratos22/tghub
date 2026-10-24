import type { Metadata } from 'next';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { SavedListings } from '@/features/market/Selling';
import styles from '../market.module.css';

export const metadata: Metadata = { title: 'Saved items' };

export default function SavedPage() {
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/saved" collapseOnMobile />
      <section className={styles.main} aria-labelledby="saved-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="saved-heading">Saved items</h2>
            <p className={styles.meta}>Listings you saved, most recent first. Sold items stay here so you can see what they went for.</p>
          </div>
        </div>
        <SavedListings />
      </section>
    </div>
  );
}
