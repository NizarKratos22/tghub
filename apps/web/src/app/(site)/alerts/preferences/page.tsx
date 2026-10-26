import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { PreferencesForm } from '@/features/alerts/PreferencesForm';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.account.alertPrefs };
}

export default async function AlertPreferencesPage() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.nav.alerts} title={t.alerts.preferences} lede={t.alerts.prefsLede} />
      <div className="container page">
        <PreferencesForm />
      </div>
    </>
  );
}
