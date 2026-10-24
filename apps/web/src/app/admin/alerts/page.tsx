import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { AlertsAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Announcements' };

export default function AlertsPage() {
  return (
    <>
      <AdminPageHeader title="Announcements" description="Publish an alert to the inbox and Discord, and check where each one was delivered." />
      <AlertsAdmin />
    </>
  );
}
