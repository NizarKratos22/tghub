import type { Metadata } from 'next';
import type { PublicProfile } from '@tgh/shared';
import { Avatar, EmptyState, Meter, Tag } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GameGrid } from '@/features/games/GameCover';
import { Icon } from '@/components/ui/Icon';
import { DiscordLogo } from '@/features/auth/oauth';
import { DiscordUsername } from '@/features/profile/DiscordUsername';
import { SellerReviews } from '@/features/market/SellerReviews';
import { ProfileActivity, ProfileFollow } from '@/features/social/ProfileSocial';
import { ClanEmblem } from '@/features/squads/shared';
import { fill } from '@/i18n/config';
import { placeName, titleName } from '@/i18n/places';
import { getFormat, getLocale, getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { levelFromXp } from '@tgh/shared';
import Link from 'next/link';
import styles from './profile.module.css';

export async function generateMetadata(props: PageProps<'/u/[username]'>): Promise<Metadata> {
  const { username } = await props.params;
  const [t, profile] = await Promise.all([getT(), serverApiOr<PublicProfile | null>(`/users/${username}`, null)]);
  return { title: profile ? `${profile.user.displayName} (@${profile.user.username})` : t.profile.notFound };
}

export default async function ProfilePage(props: PageProps<'/u/[username]'>) {
  const { username } = await props.params;
  const { user, clan, followers, following, steam, discordLinked, discordUsername, reputation, seasonRank, seasonXp, achievements, favoriteGames } = await serverApi<PublicProfile>(`/users/${username}`);
  const level = levelFromXp(user.xp);
  const [t, format, locale] = await Promise.all([getT(), getFormat(), getLocale()]);
  const home = placeName(user, t, locale);

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.bannerWrap}`}>
          <div className={user.bannerUrl ? `${styles.banner} ${styles.bannerPhoto}` : styles.banner}>
            {user.bannerUrl ? <img src={user.bannerUrl} alt="" /> : null}
          </div>
        </div>
        <div className={`container ${styles.heroGrid}`}>
          <Avatar name={user.displayName} color={user.avatarColor} src={user.avatarUrl} size={120} />
          <div className={styles.identity}>
            <Tag tone="brand">{titleName(user.title, t)}</Tag>
            <h1 className={styles.name}>{user.displayName}</h1>
            <p className={styles.handle}>
              @{user.username}
              {home ? ` · ${home}` : ''} · {fill(t.profile.joined, { date: format.dateYear(user.createdAt) })}
            </p>
            {clan ? (
              <Link href={`/clans/${clan.tag}`} className={styles.clan}>
                <ClanEmblem tag={clan.tag} color={clan.color} size={26} />
                <span>
                  {clan.name} <span className={styles.clanRole}>· {t.labels.clanRole[clan.role]}</span>
                </span>
              </Link>
            ) : null}
            {user.bio ? <p className={styles.bio} dir="auto">{user.bio}</p> : null}
            {steam || discordLinked || discordUsername ? (
              <div className={styles.links}>
                {steam ? (
                  <a href={steam.profileUrl} target="_blank" rel="noopener noreferrer" className={styles.linkChip}>
                    <Icon name="gamepad" size={14} /> {steam.personaName ?? 'Steam'} <Icon name="arrowUpRight" size={12} />
                  </a>
                ) : null}
                {discordUsername ? (
                  <DiscordUsername username={discordUsername} className={styles.linkChip} />
                ) : discordLinked ? (
                  <span className={styles.linkChip}>
                    <DiscordLogo size={14} /> {t.profile.discordLinked}
                  </span>
                ) : null}
              </div>
            ) : null}
            <ProfileFollow username={user.username} followers={followers} following={following} />
          </div>
          <div className={styles.levelBox}>
            <span className={styles.levelLabel}>{t.profile.level}</span>
            <span className={styles.level}>{user.level}</span>
            <Meter value={level.progress} segments={12} height={8} tone="gold" label={t.profile.levelProgress} />
          </div>
        </div>
        <div className={`container ${styles.stats}`}>
          <div>
            <span className="label">{t.profile.totalXp}</span>
            <strong>{format.number(user.xp)}</strong>
          </div>
          <div>
            <span className="label">{t.profile.seasonXp}</span>
            <strong>{format.number(seasonXp)}</strong>
          </div>
          <div>
            <span className="label">{t.profile.seasonRank}</span>
            <strong>{seasonRank ? `#${seasonRank}` : '—'}</strong>
          </div>
          <div>
            <span className="label">{t.profile.achievements}</span>
            <strong>{format.number(achievements.length)}</strong>
          </div>
        </div>
      </section>

      <div className="container page stack">
        <section>
          <SectionHeader title={t.profile.recentActivity} />
          <div className={styles.activity}>
            <ProfileActivity username={user.username} />
          </div>
        </section>
        {reputation.count > 0 || reputation.sales > 0 || reputation.verified ? (
          <section>
            <SectionHeader title={t.profile.reputation} />
            <SellerReviews username={user.username} reputation={reputation} />
          </section>
        ) : null}
        <section>
          <SectionHeader title={t.profile.achievements} />
          {achievements.length > 0 ? (
            <ul className={styles.achievements}>
              {achievements.map((achievement) => (
                <li key={achievement.code}>
                  <span className={styles.achievementTitle}>{achievement.title}</span>
                  <span className={styles.achievementDate}>{format.date(achievement.unlockedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="trophy" title={t.profile.noAchievements} />
          )}
        </section>
        <section>
          <SectionHeader title={t.profile.favourites} />
          {favoriteGames.length > 0 ? <GameGrid games={favoriteGames} /> : <EmptyState icon="gamepad" title={t.profile.noFavourites} />}
        </section>
      </div>
    </>
  );
}
