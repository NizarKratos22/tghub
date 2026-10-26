import type { Metadata } from 'next';
import { AdminOverview } from '@/features/admin/AdminOverview';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { TournamentImportPanel } from '@/features/admin/TournamentImportPanel';

export const metadata: Metadata = { title: 'Overview' };

export default function AdminHomePage() {
  return (
    <>
      <AdminPageHeader title="Overview" description="How TG Hub is doing — players, the marketplace and rewards — and what needs a decision." />
      <AdminOverview />
      <div style={{ marginTop: 20 }}>
        <TournamentImportPanel />
      </div>
    </>
  );
}
