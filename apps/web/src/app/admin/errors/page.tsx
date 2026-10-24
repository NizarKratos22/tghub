import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { ErrorsAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Errors' };

export default function ErrorsPage() {
  return (
    <>
      <AdminPageHeader title="Errors" description="Crashes from the API and the web app, grouped by cause. A resolved error that happens again reopens itself." />
      <ErrorsAdmin />
    </>
  );
}
