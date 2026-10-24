'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/primitives';
import { api } from '@/lib/api/client';
import { formatNumber } from '@/lib/format';
import { ActivityList, FollowButton, SOCIAL_KEYS } from './social';
import styles from './ProfileSocial.module.css';

/** Follower counts and the follow button on a profile; the count moves with the button. */
export function ProfileFollow({ username, followers, following }: { username: string; followers: number; following: number }) {
  const [followerCount, setFollowerCount] = useState(followers);
  return (
    <div className={styles.follow}>
      <div className={styles.counts}>
        <Link href={`/u/${username}/followers`}>
          <strong>{formatNumber(followerCount)}</strong> {followerCount === 1 ? 'follower' : 'followers'}
        </Link>
        <Link href={`/u/${username}/following`}>
          <strong>{formatNumber(following)}</strong> following
        </Link>
      </div>
      <FollowButton username={username} onChange={(status) => setFollowerCount(status.followers)} />
    </div>
  );
}

export function ProfileActivity({ username }: { username: string }) {
  return (
    <ActivityList
      queryKey={SOCIAL_KEYS.activity(username)}
      load={(before) => api.social.activity(username, before)}
      empty={<EmptyState icon="bolt" title="No recent activity" />}
    />
  );
}
