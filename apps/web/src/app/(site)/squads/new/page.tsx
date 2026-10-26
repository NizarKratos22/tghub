import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { LfgForm } from '@/features/squads/LfgForm';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.lfg.newTitle };
}

export default async function NewSquadPage() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.squads.code} title={t.lfg.newTitle} lede={t.lfg.newLede} />
      <div className="container page">
        <LfgForm />
      </div>
    </>
  );
}
