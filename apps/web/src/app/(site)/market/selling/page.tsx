import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { SellingDashboard } from '@/features/market/Selling';
import styles from '../market.module.css';

export const metadata: Metadata = { title: 'Your listings' };

export default function SellingPage() {
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/selling" collapseOnMobile />
      <section className={`${styles.main} ${styles.mainNarrow}`} aria-labelledby="selling-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="selling-heading">Your listings</h2>
            <p className={styles.meta}>Mark items sold, renew them to the top of the feed, or edit the details.</p>
          </div>
          <ButtonLink href="/market/sell" icon="plus" size="sm">
            New listing
          </ButtonLink>
        </div>
        <SellingDashboard />
      </section>
    </div>
  );
}
