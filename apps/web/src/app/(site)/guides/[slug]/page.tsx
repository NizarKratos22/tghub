import type { Metadata } from 'next';
import Link from 'next/link';
import type { GuideDetail, Page, Resource } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { RadarCard } from '@/features/radar/RadarCards';
import { TournamentStrip } from '@/features/tournaments/TournamentStrip';
import { getFormat, getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import styles from '../guides.module.css';

export async function generateMetadata(props: PageProps<'/guides/[slug]'>): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([props.params, getT()]);
  const guide = await serverApiOr<GuideDetail | null>(`/guides/${slug}`, null, { revalidate: 120 });
  return guide ? { title: `${guide.game.title} · ${t.guides.title}`, description: guide.intro } : { title: t.guides.title };
}

export default async function GuidePage(props: PageProps<'/guides/[slug]'>) {
  const { slug } = await props.params;
  const [t, format, guide, radarGuides] = await Promise.all([
    getT(),
    getFormat(),
    serverApi<GuideDetail>(`/guides/${slug}`, { revalidate: 120 }),
    serverApiOr<Page<Resource> | null>('/radar', null, { query: { kind: 'guide', game: slug, pageSize: 4 }, revalidate: 300 }),
  ]);
  const { game } = guide;

  return (
    <>
      <header className={styles.hero} style={{ '--accent': game.accent } as CSSProperties}>
        {game.artworkUrl ? <img src={game.artworkUrl} alt="" className={styles.heroArt} fetchPriority="high" /> : null}
        <div className={`container ${styles.heroInner}`}>
          <Link href="/guides" className={styles.back}>
            <Icon name="arrowLeft" size={14} />
            {t.guides.allGuides}
          </Link>
          <p className={styles.heroCode}>{t.guides.competitiveGuide}</p>
          <h1 className={styles.heroTitle}>{game.title}</h1>
          <p className={styles.heroIntro}>{guide.intro}</p>
          <div className={styles.heroActions}>
            <ButtonLink href={`/games/${game.slug}`} variant="secondary" icon="gamepad">
              {t.guides.gamePage}
            </ButtonLink>
            <ButtonLink href={`/pc?game=${game.slug}`} variant="outline" icon="cpu" className={styles.heroOutline}>
              {t.guides.willItRun}
            </ButtonLink>
            <span className={styles.updated}>{format.fill(t.guides.updated, { date: format.date(guide.updatedAt) })}</span>
          </div>
        </div>
      </header>

      <div className="container page">
        {t.guides.languageNote ? <p className={styles.languageNote}>{t.guides.languageNote}</p> : null}
        <div className={styles.guideLayout}>
          <div className={styles.sections}>
            {guide.sections.map((section) => (
              <section key={section.title} className={styles.section}>
                <h2>{section.title}</h2>
                <ol>
                  {section.items.map((item, index) => (
                    <li key={item.label}>
                      <span className={styles.itemNumber} aria-hidden>
                        {index + 1}
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <span className={styles.itemText}>{item.text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}

            {radarGuides && radarGuides.items.length > 0 ? (
              <section className={styles.more}>
                <h2>{format.fill(t.guides.moreGuides, { game: game.title })}</h2>
                <div className={styles.moreGrid}>
                  {radarGuides.items.map((resource) => (
                    <RadarCard key={resource.id} resource={resource} showGame={false} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className={styles.side}>
            {guide.overwolfApps.length > 0 ? (
              <section className={styles.appsBox}>
                <h2>
                  <Icon name="layers" size={18} />
                  {t.guides.appsTitle}
                </h2>
                <ul>
                  {guide.overwolfApps.map((app) => (
                    <li key={app.url}>
                      <p className={styles.appName}>{app.name}</p>
                      <p className={styles.appText}>{app.description}</p>
                      <a href={app.url} target="_blank" rel="noopener" className={styles.external}>
                        {t.guides.getApp}
                        <Icon name="arrowUpRight" size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
                {guide.overwolfStoreUrl ? (
                  <a href={guide.overwolfStoreUrl} target="_blank" rel="noopener" className={styles.moreApps}>
                    {format.fill(t.guides.moreApps, { game: game.title })}
                    <Icon name="arrowUpRight" size={14} />
                  </a>
                ) : null}
                <p className={styles.small}>{t.guides.thirdParty}</p>
              </section>
            ) : null}
            <TournamentStrip game={game.slug} />
          </aside>
        </div>
      </div>
    </>
  );
}
