import type { Metadata } from 'next';
import { AdminOverview } from '@/features/admin/AdminOverview';
import { AdminPageHeader } from '@/features/admin/AdminShell';

export const metadata: Metadata = { title: 'Overview' };

export default function AdminHomePage() {
  return (
    <>
      <AdminPageHeader title="Overview" description="How TG Hub is doing — players, the marketplace and rewards — and what needs a decision." />
      <AdminOverview />
    </>
  );
}
