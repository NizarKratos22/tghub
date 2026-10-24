import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { FollowList } from '@/features/social/FeedPage';

export async function generateMetadata(props: PageProps<'/u/[username]/following'>): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `Following · @${username}` };
}

export default async function FollowingPage(props: PageProps<'/u/[username]/following'>) {
  const { username } = await props.params;
  return (
    <>
      <PageHeader code={`@${username}`} title="Following">
        <Link href={`/u/${username}/followers`} className="label">
          Followers →
        </Link>
      </PageHeader>
      <div className="container page">
        <FollowList username={username} direction="following" />
      </div>
    </>
  );
}
