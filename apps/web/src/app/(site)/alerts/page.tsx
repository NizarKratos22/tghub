import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Inbox } from '@/features/alerts/Inbox';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.nav.alerts };
}

export default async function AlertsPage() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.alerts.code} title={t.nav.alerts} lede={t.alerts.lede} />
      <div className="container page">
        <Inbox />
      </div>
    </>
  );
}
