import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Inbox } from '@/features/alerts/Inbox';

export const metadata: Metadata = { title: 'Alerts' };

export default function AlertsPage() {
  return (
    <>
      <PageHeader code="Your inbox" title="Alerts" lede="Patch notes for the games you follow, deals before they expire, tournaments and your own milestones. Each announcement arrives once." />
      <div className="container page">
        <Inbox />
      </div>
    </>
  );
}
