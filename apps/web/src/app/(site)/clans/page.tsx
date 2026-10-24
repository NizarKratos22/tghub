import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { getT } from '@/i18n/server';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/primitives';
import { ClanDirectory } from '@/features/squads/ClanDirectory';
import { SquadsTabs } from '@/features/squads/shared';

export const metadata: Metadata = {
  title: 'Clans',
  description: 'Player-run clans and the season standings: members pool their XP and race for the top spot.',
};

export default async function ClansPage() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.squads.code} title={t.squads.clansTitle} lede={t.squads.clansLede}>
        <ButtonLink href="/clans/new" icon="plus" variant="outline">
          {t.squads.createClan}
        </ButtonLink>
      </PageHeader>
      <div className="container page stack">
        <SquadsTabs active="clans" />
        <Suspense fallback={<Skeleton height={420} />}>
          <ClanDirectory />
        </Suspense>
      </div>
    </>
  );
}
