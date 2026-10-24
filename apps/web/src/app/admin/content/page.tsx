import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { ContentAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Radar content' };

export default function ContentPage() {
  return (
    <>
      <AdminPageHeader title="Radar content" description="Add news, guides, deals and events by hand, or remove items from the Radar." />
      <ContentAdmin />
    </>
  );
}
