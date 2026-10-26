'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/primitives';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { ActivityList, FollowButton, SOCIAL_KEYS } from './social';
import styles from './ProfileSocial.module.css';

/** Follower counts and the follow button on a profile; the count moves with the button. */
export function ProfileFollow({ username, followers, following }: { username: string; followers: number; following: number }) {
  const t = useT();
  const format = useFormat();
  const [followerCount, setFollowerCount] = useState(followers);
  return (
    <div className={styles.follow}>
      <div className={styles.counts}>
        <Link href={`/u/${username}/followers`}>
          <strong>{format.number(followerCount)}</strong> {format.fill(t.social.followers, { count: followerCount })}
        </Link>
        <Link href={`/u/${username}/following`}>
          <strong>{format.number(following)}</strong> {t.social.following}
        </Link>
      </div>
      <FollowButton username={username} onChange={(status) => setFollowerCount(status.followers)} />
    </div>
  );
}

export function ProfileActivity({ username }: { username: string }) {
  const t = useT();
  return (
    <ActivityList
      queryKey={SOCIAL_KEYS.activity(username)}
      load={(before) => api.social.activity(username, before)}
      empty={<EmptyState icon="bolt" title={t.social.noActivity} />}
    />
  );
}
