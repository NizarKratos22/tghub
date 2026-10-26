'use client';

import Link from 'next/link';
import type { Resource, ResourceKind } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Countdown, RelativeTime } from '@/components/ui/time';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { isExternal, isUrgent } from '@/lib/format';
import { KIND_ICONS, toneClass } from './kinds';
import { OutLink } from './ResourceRow';
import styles from './RadarCards.module.css';

export function KindPill({ kind, solid }: { kind: ResourceKind; solid?: boolean }) {
  const t = useT();
  return (
    <span className={cx(styles.pill, solid && styles.pillSolid, toneClass(kind))}>
      <Icon name={KIND_ICONS[kind]} size={12} />
      {t.labels.resourceKind[kind]}
    </span>
  );
}

/** The story's picture, or — when it has none — radar rings: on the game's colour with its monogram, else on charcoal in the kind's colour. */
function Art({ resource, wide }: { resource: Resource; wide?: boolean }) {
  const { image } = resource;
  if (image) {
    // Hot-linked from Steam's and IGDB's CDNs, already sized. The lead is the page's biggest picture, so it loads first.
    return wide ? (
      <img
        src={image.wideUrl}
        srcSet={image.fromGame ? `${image.url} 889w, ${image.wideUrl} 1920w` : undefined}
        sizes={image.fromGame ? '(max-width: 1100px) 100vw, 64vw' : undefined}
        alt=""
        className={styles.picture}
        fetchPriority="high"
      />
    ) : (
      <img src={image.url} alt="" className={styles.picture} loading="lazy" decoding="async" />
    );
  }
  const accent = resource.game?.accent;
  return (
    <span className={cx(styles.fallback, accent && styles.fallbackGame)} style={accent ? ({ '--art': accent } as CSSProperties) : undefined} aria-hidden>
      {resource.game ? <span className={styles.monogram}>{resource.game.monogram}</span> : <Icon name={KIND_ICONS[resource.kind]} size={44} />}
    </span>
  );
}

function Badge({ resource }: { resource: Resource }) {
  const format = useFormat();
  if (resource.deal?.discountPct) {
    return <span className={styles.discount}>−{resource.deal.discountPct}%</span>;
  }
  if (resource.kind === 'event' && resource.startsAt) {
    const tile = format.dateTile(resource.startsAt);
    return (
      <span className={styles.dateTile}>
        <span>{tile.month}</span>
        <strong>{tile.day}</strong>
      </span>
    );
  }
  return null;
}

function GameTag({ game }: { game: NonNullable<Resource['game']> }) {
  return (
    <Link href={`/games/${game.slug}`} className={styles.game} style={{ '--accent': game.accent } as CSSProperties}>
      <span className={styles.gameDot} aria-hidden />
      <bdi>{game.title}</bdi>
    </Link>
  );
}

function Extras({ resource }: { resource: Resource }) {
  const format = useFormat();
  const { deal } = resource;
  return (
    <>
      {deal ? (
        <span className={styles.price}>
          <strong>{format.price(deal.price, deal.currency)}</strong>
          {deal.originalPrice ? <s>{format.price(deal.originalPrice, deal.currency)}</s> : null}
          <span>{deal.store}</span>
        </span>
      ) : null}
      {resource.kind === 'deal' && resource.expiresAt ? (
        <Countdown iso={resource.expiresAt} className={cx(styles.countdown, isUrgent(resource.expiresAt) && styles.urgent)} />
      ) : null}
      {resource.kind === 'event' && resource.startsAt ? (
        <span className={styles.when}>
          <Icon name="clock" size={12} />
          {format.dateTime(resource.startsAt)}
          {resource.location ? ` · ${resource.location}` : ''}
        </span>
      ) : null}
    </>
  );
}

/** A Radar story as a picture card — the Radar grid and game pages (which leave out the game's own name). */
export function RadarCard({ resource, showGame = true }: { resource: Resource; showGame?: boolean }) {
  const external = isExternal(resource.url);
  return (
    <article className={cx(styles.card, toneClass(resource.kind), resource.isExpired && styles.expired)}>
      <div className={styles.media}>
        <Art resource={resource} />
        <span className={styles.corner}>
          <KindPill kind={resource.kind} solid />
        </span>
        <span className={styles.cornerEnd}>
          <Badge resource={resource} />
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          {showGame && resource.game ? <GameTag game={resource.game} /> : null}
          <RelativeTime iso={resource.publishedAt} className={styles.time} />
        </div>
        <h3 className={styles.title}>
          <OutLink href={resource.url} className={styles.stretch}>
            <bdi>{resource.title}</bdi>
          </OutLink>
        </h3>
        {resource.summary ? (
          <p className={styles.summary} dir="auto">
            {resource.summary}
          </p>
        ) : null}
        <div className={styles.foot}>
          <Extras resource={resource} />
          <span className={styles.source}>
            <bdi>{resource.sourceName}</bdi>
            {external ? <Icon name="arrowUpRight" size={12} /> : null}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Spotlight story: the picture fills the tile and the words sit on it. `lead` is the big one. */
export function SpotlightStory({ resource, lead }: { resource: Resource; lead?: boolean }) {
  const t = useT();
  const external = isExternal(resource.url);
  return (
    <article className={cx(styles.spot, lead && styles.spotLead, toneClass(resource.kind), resource.isExpired && styles.expired)}>
      <Art resource={resource} wide={lead} />
      <span className={styles.cornerEnd}>
        <Badge resource={resource} />
      </span>
      <div className={styles.spotBody}>
        <div className={styles.spotMeta}>
          <KindPill kind={resource.kind} solid />
          {resource.game ? <bdi className={styles.spotGame}>{resource.game.title}</bdi> : null}
          <RelativeTime iso={resource.publishedAt} />
        </div>
        <h2 className={styles.spotTitle}>
          <OutLink href={resource.url} className={styles.stretch}>
            <bdi>{resource.title}</bdi>
          </OutLink>
        </h2>
        {lead && resource.summary ? (
          <p className={styles.spotSummary} dir="auto">
            {resource.summary}
          </p>
        ) : null}
        {lead ? (
          <span className={styles.spotSource}>
            {fill(t.radar.readOn, { source: resource.sourceName })}
            <Icon name={external ? 'arrowUpRight' : 'arrowRight'} size={14} className={external ? undefined : 'dir-flip'} />
          </span>
        ) : null}
      </div>
    </article>
  );
}
