'use client';

import { TournamentLinkImport } from '@/features/tournaments/TournamentLinkImport';
import { Panel } from './sections';

/** "Add a tournament by link", for admin pages other than Tournaments. */
export function TournamentImportPanel() {
  return (
    <Panel title="Add a tournament by link">
      <TournamentLinkImport />
    </Panel>
  );
}
