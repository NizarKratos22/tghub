import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { UsersAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Players' };

export default function UsersPage() {
  return (
    <>
      <AdminPageHeader title="Players" description="Search accounts, confirm emails by hand, change roles and suspend players." />
      <UsersAdmin />
    </>
  );
}
