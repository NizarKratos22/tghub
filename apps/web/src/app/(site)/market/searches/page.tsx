import type { Metadata } from 'next';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { SavedSearchList } from '@/features/market/SavedSearches';
import styles from '../market.module.css';

export const metadata: Metadata = { title: 'Saved searches' };

export default function SavedSearchesPage() {
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/searches" collapseOnMobile />
      <section className={styles.main} aria-labelledby="searches-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="searches-heading">Saved searches</h2>
            <p className={styles.meta}>We alert you when a new listing matches — on the site, and on your phone if notifications are on.</p>
          </div>
        </div>
        <SavedSearchList />
      </section>
    </div>
  );
}
