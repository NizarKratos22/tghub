import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { CreateClanForm } from '@/features/squads/ClanForm';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.clan.newTitle };
}

export default async function NewClanPage() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.squads.code} title={t.clan.newTitle} lede={t.clan.newLede} />
      <div className="container page" style={{ maxWidth: 900 }}>
        <CreateClanForm />
      </div>
    </>
  );
}
