import type { Metadata } from 'next';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { NewListing } from '@/features/market/SellGate';
import styles from '../market.module.css';

export const metadata: Metadata = { title: 'Create a listing' };

export default function SellPage() {
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/sell" collapseOnMobile />
      <section className={`${styles.main} ${styles.mainNarrow}`} aria-labelledby="sell-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="sell-heading">Create new listing</h2>
            <p className={styles.meta}>Gear, consoles, games — or digital assets like FiveM scripts, MLOs and server bases.</p>
          </div>
        </div>
        <NewListing />
      </section>
    </div>
  );
}
