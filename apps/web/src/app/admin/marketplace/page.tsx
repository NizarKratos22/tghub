import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { MarketAdmin } from '@/features/admin/MarketAdmin';

export const metadata: Metadata = { title: 'Marketplace' };

export default function MarketplacePage() {
  return (
    <>
      <AdminPageHeader title="Marketplace" description="Listings land in the queue after three separate reports. Removing one tells the seller why." />
      <MarketAdmin />
    </>
  );
}
