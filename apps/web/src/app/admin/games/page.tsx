import type { Metadata } from 'next';
import { AdminPageHeader } from '@/features/admin/AdminShell';
import { TournamentImportPanel } from '@/features/admin/TournamentImportPanel';
import { GamesAdmin } from '@/features/admin/sections';

export const metadata: Metadata = { title: 'Games' };

export default function GamesPage() {
  return (
    <>
      <AdminPageHeader title="Games" description="The catalogue and where its data comes from. Add games from IGDB, fix a wrong match, or refresh everything now." />
      <GamesAdmin />
      <div style={{ marginTop: 20 }}>
        <TournamentImportPanel />
      </div>
    </>
  );
}
