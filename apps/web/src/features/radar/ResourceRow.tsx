'use client';

import Link from 'next/link';
import type { Resource } from '@tgh/shared';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Countdown } from '@/components/ui/time';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { isExternal, isUrgent } from '@/lib/format';
import { KIND_ICONS, toneClass } from './kinds';
import styles from './ResourceRow.module.css';

export function OutLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
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
  const t = useT();
  return <span className={cx(styles.kind, styles[`kind_${kind}`])}>{t.labels.resourceKind[kind]}</span>;
}

function DealPrice({ deal }: { deal: NonNullable<Resource['deal']> }) {
  const format = useFormat();
  return (
    <span className={styles.price}>
      {deal.discountPct ? <span className={styles.discount}>−{deal.discountPct}%</span> : null}
      {deal.originalPrice ? <s>{format.price(deal.originalPrice, deal.currency)}</s> : null}
      <strong>{format.price(deal.price, deal.currency)}</strong>
      <span className={styles.store}>{deal.store}</span>
    </span>
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
        <Countdown iso={resource.expiresAt} label="{time}" className={cx(styles.countdown, isUrgent(resource.expiresAt) && styles.urgent)} />
      ) : null}
    </OutLink>
  );
}

/** Headline line for the home feed: thumbnail, kind and date, title. */
export function NewsLine({ resource }: { resource: Resource }) {
  const format = useFormat();
  return (
    <OutLink href={resource.url} className={styles.news}>
      <span className={cx(styles.thumb, toneClass(resource.kind))}>
        {resource.image ? (
          <img src={resource.image.url} alt="" loading="lazy" decoding="async" />
        ) : (
          <Icon name={KIND_ICONS[resource.kind]} size={18} />
        )}
      </span>
      <span className={styles.newsMain}>
        <span className={styles.newsMeta}>
          <KindLabel kind={resource.kind} />
          <time dateTime={resource.publishedAt}>{format.date(resource.publishedAt)}</time>
          <bdi className={styles.newsGame}>{resource.game?.title ?? resource.sourceName}</bdi>
        </span>
        <bdi className={styles.newsTitle}>{resource.title}</bdi>
      </span>
    </OutLink>
  );
}
