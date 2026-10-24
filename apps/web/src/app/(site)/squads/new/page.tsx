import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { LfgForm } from '@/features/squads/LfgForm';

export const metadata: Metadata = { title: 'Post a squad' };

export default function NewSquadPage() {
  return (
    <>
      <PageHeader code="Squads" title="Post a squad" lede="Say what you're playing and who you need. Players ask to join; you pick who fits." />
      <div className="container page">
        <LfgForm />
      </div>
    </>
  );
}
