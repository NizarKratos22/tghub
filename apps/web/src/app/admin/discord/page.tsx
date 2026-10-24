import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { DiscordAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Discord' };

export default function DiscordPage() {
  return (
    <>
      <AdminPageHeader title="Discord" description="Webhook channels and the alert categories each one receives." />
      <DiscordAdmin />
    </>
  );
}
