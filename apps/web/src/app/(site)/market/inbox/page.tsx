import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { MarketInbox } from '@/features/market/Inbox';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import styles from '../market.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.chat.title };
}

export default async function InboxPage() {
  const t = await getT();
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/inbox" collapseOnMobile />
      <section className={styles.main} aria-label={t.chat.title}>
        <MarketInbox />
      </section>
    </div>
  );
}
