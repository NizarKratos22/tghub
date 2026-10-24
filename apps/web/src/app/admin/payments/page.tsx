import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { PaymentsAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Payments' };

export default function PaymentsPage() {
  return (
    <>
      <AdminPageHeader title="Payments" description="Featured-listing orders, their status with the payment provider, and revenue." />
      <PaymentsAdmin />
    </>
  );
}
