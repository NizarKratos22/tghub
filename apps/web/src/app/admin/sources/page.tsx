import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { SourcesAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Sources' };

export default function SourcesPage() {
  return (
    <>
      <AdminPageHeader title="Sources" description="Official feeds polled for patch notes and news. Five failures in a row disable a source." />
      <SourcesAdmin />
    </>
  );
}
