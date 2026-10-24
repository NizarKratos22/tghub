import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { CreateClanForm } from '@/features/squads/ClanForm';

export const metadata: Metadata = { title: 'Create a clan' };

export default function NewClanPage() {
  return (
    <>
      <PageHeader code="Squads" title="Create a clan" lede="Pick a tag and a colour, say what you play, and choose who can join." />
      <div className="container page" style={{ maxWidth: 900 }}>
        <CreateClanForm />
      </div>
    </>
  );
}
