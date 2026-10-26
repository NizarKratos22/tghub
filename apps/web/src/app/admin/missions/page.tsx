import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { ProgressionAdmin } from '@/features/admin/ProgressionAdmin';

export const metadata: Metadata = { title: 'Missions & XP' };

export default function MissionsPage() {
  return (
    <>
      <AdminPageHeader title="Missions & XP" description="Missions, achievements, seasons and the community Pulse, plus manual XP adjustments. Changes reach players straight away." />
      <ProgressionAdmin />
    </>
  );
}
