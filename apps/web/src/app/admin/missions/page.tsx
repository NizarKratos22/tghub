import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { MissionsAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Missions & XP' };

export default function MissionsPage() {
  return (
    <>
      <AdminPageHeader title="Missions & XP" description="Changes apply to the current period immediately." />
      <MissionsAdmin />
    </>
  );
}
