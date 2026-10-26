import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { PcLab } from '@/features/pc/PcLab';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.nav.pc };
}

export default async function PcLabPage(props: PageProps<'/pc'>) {
  const [{ game }, t] = await Promise.all([props.searchParams, getT()]);
  return (
    <>
      <PageHeader code={t.pc.code} title={t.nav.pc} lede={t.pc.lede} />
      <div className="container page">
        <PcLab initialGame={typeof game === 'string' ? game : undefined} />
      </div>
    </>
  );
}
