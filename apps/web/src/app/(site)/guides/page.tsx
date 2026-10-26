import type { Metadata } from 'next';
import Link from 'next/link';
import type { GuideSummary } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/primitives';
import { getFormat, getT } from '@/i18n/server';
import { serverApiOr } from '@/lib/api/server';
import styles from './guides.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.guides.title, description: t.guides.lede };
}

export default async function GuidesPage() {
  const [t, format, guides] = await Promise.all([getT(), getFormat(), serverApiOr<GuideSummary[]>('/guides', [], { revalidate: 120 })]);

  return (
    <>
      <PageHeader code={t.guides.code} title={t.guides.title} lede={t.guides.lede} />
      <div className="container page">
        <div className={styles.hubLayout}>
          <div>
            {t.guides.languageNote ? <p className={styles.languageNote}>{t.guides.languageNote}</p> : null}
            {guides.length > 0 ? (
              <ul className={styles.cards}>
                {guides.map((guide) => (
                  <li key={guide.game.id}>
                    <Link href={`/guides/${guide.game.slug}`} className={styles.card} style={{ '--accent': guide.game.accent } as CSSProperties}>
                      <span className={styles.cardCover} aria-hidden>
                        {guide.game.coverUrl ? <img src={guide.game.coverUrl} alt="" loading="lazy" decoding="async" /> : <span>{guide.game.monogram}</span>}
                      </span>
                      <span className={styles.cardBody}>
                        <span className={styles.cardTitle}>{format.fill(t.guides.guideFor, { game: guide.game.title })}</span>
                        <span className={styles.cardIntro}>{guide.intro}</span>
                        <span className={styles.cardChips}>
                          {guide.sectionTitles.map((title) => (
                            <span key={title} className={styles.chip}>
                              {title}
                            </span>
                          ))}
                        </span>
                        <span className={styles.cardFoot}>
                          {guide.appCount > 0 ? (
                            <span className={styles.apps}>
                              <Icon name="layers" size={14} />
                              {format.fill(t.guides.apps, { count: guide.appCount })}
                            </span>
                          ) : null}
                          <span className={styles.read}>
                            {t.guides.read}
                            <Icon name="arrowRight" size={14} />
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="map" title={t.guides.emptyTitle}>
                {t.guides.emptyText}
              </EmptyState>
            )}
          </div>

          <aside className={styles.overwolf}>
            <span className={styles.overwolfIcon} aria-hidden>
              <Icon name="layers" size={20} />
            </span>
            <h2>{t.guides.overwolfTitle}</h2>
            <p>{t.guides.overwolfText}</p>
            <a href="https://www.overwolf.com/" target="_blank" rel="noopener" className={styles.external}>
              {t.guides.overwolfLink}
              <Icon name="arrowUpRight" size={14} />
            </a>
            <p className={styles.small}>{t.guides.thirdParty}</p>
          </aside>
        </div>
      </div>
    </>
  );
}
