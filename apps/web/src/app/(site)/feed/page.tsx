import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { getT } from '@/i18n/server';
import { FeedPage } from '@/features/social/FeedPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.feed.title };
}

export default async function Feed() {
  const t = await getT();
  return (
    <>
      <PageHeader code={t.feed.code} title={t.feed.title} lede={t.feed.lede} />
      <div className="container page">
        <FeedPage />
      </div>
    </>
  );
}
