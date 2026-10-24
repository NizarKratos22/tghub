import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { TournamentsAdmin } from '@/features/admin/TournamentsAdmin';

export const metadata: Metadata = { title: 'Tournaments' };

export default function TournamentsPage() {
  return (
    <>
      <AdminPageHeader title="Tournaments" description="Connected platforms, discovery sources, imports by link and what shows on TG Hub." />
      <TournamentsAdmin />
    </>
  );
}
