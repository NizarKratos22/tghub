import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { getT } from '@/i18n/server';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/primitives';
import { LfgBoard } from '@/features/squads/LfgBoard';
import { SquadsTabs } from '@/features/squads/shared';

export const metadata: Metadata = {
  title: 'Find teammates',
  description: 'Post what you want to play or join players already looking — ranked duos, squads, roleplay nights.',
};

export default async function SquadsPage() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.squads.code} title={t.squads.lfgTitle} lede={t.squads.lfgLede}>
        <ButtonLink href="/squads/new" icon="plus">
          {t.squads.postSquad}
        </ButtonLink>
      </PageHeader>
      <div className="container page stack">
        <SquadsTabs active="lfg" />
        <Suspense fallback={<Skeleton height={420} />}>
          <LfgBoard />
        </Suspense>
      </div>
    </>
  );
}
