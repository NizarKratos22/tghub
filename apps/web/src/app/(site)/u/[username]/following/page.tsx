import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { FollowList } from '@/features/social/FeedPage';

export async function generateMetadata(props: PageProps<'/u/[username]/following'>): Promise<Metadata> {
  const [{ username }, t] = await Promise.all([props.params, getT()]);
  return { title: fill(t.social.followingOf, { username }) };
}

export default async function FollowingPage(props: PageProps<'/u/[username]/following'>) {
  const [{ username }, t] = await Promise.all([props.params, getT()]);
  return (
    <>
      <PageHeader code={`@${username}`} title={t.social.followingTitle}>
        <Link href={`/u/${username}/followers`} className="label">
          {t.social.followersTitle} <Icon name="arrowRight" size={12} />
        </Link>
      </PageHeader>
      <div className="container page">
        <FollowList username={username} direction="following" />
      </div>
    </>
  );
}
