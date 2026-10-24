import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketInbox } from '@/features/market/Inbox';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import styles from '../../market.module.css';

export const metadata: Metadata = { title: 'Marketplace inbox' };

export default async function ConversationPage(props: PageProps<'/market/inbox/[id]'>) {
  const { id } = await props.params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/inbox" collapseOnMobile />
      <section className={styles.main} aria-label="Marketplace inbox">
        <MarketInbox activeId={id} />
      </section>
    </div>
  );
}
