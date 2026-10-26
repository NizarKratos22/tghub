import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { getT } from '@/i18n/server';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/primitives';
import { LfgBoard } from '@/features/squads/LfgBoard';
import { SquadsTabs } from '@/features/squads/shared';
import { TournamentStrip } from '@/features/tournaments/TournamentStrip';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.squads.lfgTitle, description: t.squads.lfgLede };
}

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
        <TournamentStrip limit={4} note={t.squads.tournamentsNote} />
      </div>
    </>
  );
}
