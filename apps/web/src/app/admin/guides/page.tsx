import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { GuidesAdmin } from '@/features/admin/GuidesAdmin';

export const metadata: Metadata = { title: 'Guides' };

export default function GuidesAdminPage() {
  return (
    <>
      <AdminPageHeader title="Guides" description="Competitive guides for each game — settings, roles, habits — and the Overwolf apps worth installing." />
      <GuidesAdmin />
    </>
  );
}
