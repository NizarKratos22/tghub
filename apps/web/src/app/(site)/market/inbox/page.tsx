import type { Metadata } from 'next';
import { MarketInbox } from '@/features/market/Inbox';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import styles from '../market.module.css';

export const metadata: Metadata = { title: 'Marketplace inbox' };

export default function InboxPage() {
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/inbox" collapseOnMobile />
      <section className={styles.main} aria-label="Marketplace inbox">
        <MarketInbox />
      </section>
    </div>
  );
}
