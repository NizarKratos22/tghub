import type { Metadata } from 'next';
import type { PublicProfile } from '@tgh/shared';
import { Avatar, EmptyState, Meter, Tag } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GameGrid } from '@/features/games/GameCover';
import { Icon } from '@/components/ui/Icon';
import { DiscordLogo } from '@/features/auth/oauth';
import { SellerReviews } from '@/features/market/SellerReviews';
import { ProfileActivity, ProfileFollow } from '@/features/social/ProfileSocial';
import { ClanEmblem } from '@/features/squads/shared';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { formatDate, formatDateYear, formatNumber } from '@/lib/format';
import { CLAN_ROLE_LABELS, homeLabel, levelFromXp } from '@tgh/shared';
import Link from 'next/link';
import styles from './profile.module.css';

export async function generateMetadata(props: PageProps<'/u/[username]'>): Promise<Metadata> {
  const { username } = await props.params;
  const profile = await serverApiOr<PublicProfile | null>(`/users/${username}`, null);
  return { title: profile ? `${profile.user.displayName} (@${profile.user.username})` : 'Player not found' };
}

export default async function ProfilePage(props: PageProps<'/u/[username]'>) {
  const { username } = await props.params;
  const { user, clan, followers, following, steam, discordLinked, reputation, seasonRank, seasonXp, achievements, favoriteGames } = await serverApi<PublicProfile>(`/users/${username}`);
  const level = levelFromXp(user.xp);

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.bannerWrap}`}>
          <div className={user.bannerUrl ? `${styles.banner} ${styles.bannerPhoto}` : styles.banner}>
            {/* eslint-disable-next-line @next/next/no-img-element -- immutable media URL */}
            {user.bannerUrl ? <img src={user.bannerUrl} alt="" /> : null}
          </div>
        </div>
        <div className={`container ${styles.heroGrid}`}>
          <Avatar name={user.displayName} color={user.avatarColor} src={user.avatarUrl} size={120} />
          <div className={styles.identity}>
            <Tag tone="brand">{user.title}</Tag>
            <h1 className={styles.name}>{user.displayName}</h1>
            <p className={styles.handle}>
              @{user.username}
              {homeLabel(user) ? ` · ${homeLabel(user)}` : ''} · joined {formatDateYear(user.createdAt)}
            </p>
            {clan ? (
              <Link href={`/clans/${clan.tag}`} className={styles.clan}>
                <ClanEmblem tag={clan.tag} color={clan.color} size={26} />
                <span>
                  {clan.name} <span className={styles.clanRole}>· {CLAN_ROLE_LABELS[clan.role]}</span>
                </span>
              </Link>
            ) : null}
            {user.bio ? <p className={styles.bio}>{user.bio}</p> : null}
            {steam || discordLinked ? (
              <div className={styles.links}>
                {steam ? (
                  <a href={steam.profileUrl} target="_blank" rel="noopener noreferrer" className={styles.linkChip}>
                    <Icon name="gamepad" size={14} /> {steam.personaName ?? 'Steam'} <Icon name="arrowUpRight" size={12} />
                  </a>
                ) : null}
                {discordLinked ? (
                  <span className={styles.linkChip}>
                    <DiscordLogo size={14} /> Discord linked
                  </span>
                ) : null}
              </div>
            ) : null}
            <ProfileFollow username={user.username} followers={followers} following={following} />
          </div>
          <div className={styles.levelBox}>
            <span className={styles.levelLabel}>Level</span>
            <span className={styles.level}>{user.level}</span>
            <Meter value={level.progress} segments={12} height={8} tone="gold" label="Level progress" />
          </div>
        </div>
        <div className={`container ${styles.stats}`}>
          <div>
            <span className="label">Total XP</span>
            <strong>{formatNumber(user.xp)}</strong>
          </div>
          <div>
            <span className="label">Season XP</span>
            <strong>{formatNumber(seasonXp)}</strong>
          </div>
          <div>
            <span className="label">Season rank</span>
            <strong>{seasonRank ? `#${seasonRank}` : '—'}</strong>
          </div>
          <div>
            <span className="label">Achievements</span>
            <strong>{achievements.length}</strong>
          </div>
        </div>
      </section>

      <div className="container page stack">
        <section>
          <SectionHeader title="Recent activity" />
          <div className={styles.activity}>
            <ProfileActivity username={user.username} />
          </div>
        </section>
        {reputation.count > 0 || reputation.sales > 0 || reputation.verified ? (
          <section>
            <SectionHeader title="Marketplace reputation" />
            <SellerReviews username={user.username} reputation={reputation} />
          </section>
        ) : null}
        <section>
          <SectionHeader title="Achievements" />
          {achievements.length > 0 ? (
            <ul className={styles.achievements}>
              {achievements.map((achievement) => (
                <li key={achievement.code}>
                  <span className={styles.achievementTitle}>{achievement.title}</span>
                  <span className={styles.achievementDate}>{formatDate(achievement.unlockedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="trophy" title="No achievements yet" />
          )}
        </section>
        <section>
          <SectionHeader title="Favourite games" />
          {favoriteGames.length > 0 ? <GameGrid games={favoriteGames} /> : <EmptyState icon="gamepad" title="No favourites yet" />}
        </section>
      </div>
    </>
  );
}
