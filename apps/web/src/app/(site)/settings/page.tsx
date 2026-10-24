import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SecuritySettings } from '@/features/profile/SecuritySettings';
import { SettingsForm } from '@/features/profile/SettingsForm';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch';
import { getT } from '@/i18n/server';
import styles from './settings.module.css';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.settings.code} title={t.settings.title} lede={t.settings.lede}>
        <div className={styles.language}>
          <span>{t.settings.languageHint}</span>
          <LanguageSwitch />
        </div>
      </PageHeader>
      <div className={`container page ${styles.grid}`}>
        <section>
          <SectionHeader title={t.settings.profile} />
          <SettingsForm />
        </section>
        <section>
          <SectionHeader title={t.settings.security} />
          <SecuritySettings />
        </section>
      </div>
    </>
  );
}
