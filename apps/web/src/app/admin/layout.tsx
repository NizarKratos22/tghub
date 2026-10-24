import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/features/admin/AdminShell';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · TG Hub Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
