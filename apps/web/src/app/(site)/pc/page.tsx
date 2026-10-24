import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { PcLab } from '@/features/pc/PcLab';

export const metadata: Metadata = { title: 'PC Lab' };

export default async function PcLabPage(props: PageProps<'/pc'>) {
  const { game } = await props.searchParams;
  return (
    <>
      <PageHeader
        code="Will it run?"
        title="PC Lab"
        lede="Compare your rig with each game's published requirements. No invented FPS numbers — when we don't have the data, we say so."
      />
      <div className="container page">
        <PcLab initialGame={typeof game === 'string' ? game : undefined} />
      </div>
    </>
  );
}
