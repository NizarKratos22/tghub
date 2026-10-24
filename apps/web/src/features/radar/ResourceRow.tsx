import Link from 'next/link';
import { RESOURCE_KIND_LABELS, type Resource } from '@tgh/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Countdown } from '@/components/ui/time';
import { cx } from '@/lib/cx';
import { formatDate, formatDateTime, formatPrice, isExternal, isUrgent } from '@/lib/format';
import styles from './ResourceRow.module.css';

function OutLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function KindLabel({ kind }: { kind: Resource['kind'] }) {
  return <span className={cx(styles.kind, styles[`kind_${kind}`])}>{RESOURCE_KIND_LABELS[kind]}</span>;
}

function GameChip({ game }: { game: NonNullable<Resource['game']> }) {
  return (
    <Link href={`/games/${game.slug}`} className={styles.game} style={{ '--accent': game.accent } as CSSProperties}>
      <span className={styles.gameDot} aria-hidden />
      {game.title}
    </Link>
  );
}

function DealPrice({ deal }: { deal: NonNullable<Resource['deal']> }) {
  return (
    <span className={styles.price}>
      {deal.discountPct ? <span className={styles.discount}>−{deal.discountPct}%</span> : null}
      {deal.originalPrice ? <s>{formatPrice(deal.originalPrice, deal.currency)}</s> : null}
      <strong>{formatPrice(deal.price, deal.currency)}</strong>
      <span className={styles.store}>{deal.store}</span>
    </span>
  );
}

/** Full Radar feed row. */
export function ResourceRow({ resource }: { resource: Resource }) {
  return (
    <article className={cx(styles.row, resource.isExpired && styles.expired)}>
      <div className={styles.meta}>
        <KindLabel kind={resource.kind} />
        <time className={styles.date} dateTime={resource.publishedAt}>
          {formatDate(resource.publishedAt)}
        </time>
      </div>
      <div className={styles.body}>
        <OutLink href={resource.url} className={styles.title}>
          {resource.title}
          {isExternal(resource.url) ? <Icon name="arrowUpRight" size={14} className={styles.out} /> : null}
        </OutLink>
        {resource.summary ? <p className={styles.summary}>{resource.summary}</p> : null}
        <div className={styles.foot}>
          {resource.game ? <GameChip game={resource.game} /> : null}
          <span className={styles.source}>{resource.sourceName}</span>
          {resource.kind === 'event' && resource.startsAt ? (
            <span className={styles.when}>
              {formatDateTime(resource.startsAt)}
              {resource.location ? ` · ${resource.location}` : ''}
            </span>
          ) : null}
          {resource.deal ? <DealPrice deal={resource.deal} /> : null}
          {resource.kind === 'deal' && resource.expiresAt ? (
            <Countdown iso={resource.expiresAt} className={cx(styles.countdown, isUrgent(resource.expiresAt) && styles.urgent)} />
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Compact deal line for sidebars. */
export function DealLine({ resource }: { resource: Resource }) {
  return (
    <OutLink href={resource.url} className={styles.line}>
      <span className={styles.lineMain}>
        <span className={styles.lineTitle}>{resource.title}</span>
        {resource.deal ? <DealPrice deal={resource.deal} /> : null}
      </span>
      {resource.expiresAt ? (
        <Countdown iso={resource.expiresAt} prefix="" className={cx(styles.countdown, isUrgent(resource.expiresAt) && styles.urgent)} />
      ) : null}
    </OutLink>
  );
}

/** Headline line for the home feed. */
export function NewsLine({ resource }: { resource: Resource }) {
  return (
    <OutLink href={resource.url} className={styles.news}>
      <span className={styles.newsMeta}>
        <KindLabel kind={resource.kind} />
        <time dateTime={resource.publishedAt}>{formatDate(resource.publishedAt)}</time>
      </span>
      <span className={styles.newsTitle}>{resource.title}</span>
      {resource.game ? <span className={styles.newsGame}>{resource.game.title}</span> : <span className={styles.newsGame}>{resource.sourceName}</span>}
    </OutLink>
  );
}
