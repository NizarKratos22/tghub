import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { FollowList } from '@/features/social/FeedPage';

export async function generateMetadata(props: PageProps<'/u/[username]/followers'>): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `Followers · @${username}` };
}

export default async function FollowersPage(props: PageProps<'/u/[username]/followers'>) {
  const { username } = await props.params;
  return (
    <>
      <PageHeader code={`@${username}`} title="Followers">
        <Link href={`/u/${username}/following`} className="label">
          Following →
        </Link>
      </PageHeader>
      <div className="container page">
        <FollowList username={username} direction="followers" />
      </div>
    </>
  );
}
