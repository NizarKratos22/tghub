import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { PreferencesForm } from '@/features/alerts/PreferencesForm';

export const metadata: Metadata = { title: 'Alert preferences' };

export default function AlertPreferencesPage() {
  return (
    <>
      <PageHeader code="Alerts" title="Preferences" lede="Low noise by default: every category is on, but game updates only arrive for games you follow." />
      <div className="container page">
        <PreferencesForm />
      </div>
    </>
  );
}
