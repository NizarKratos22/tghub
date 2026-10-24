import Link from 'next/link';
import { RESOURCE_KIND_LABELS, type Resource } from '@tgh/shared';
import { isExternal } from '@/lib/format';
import styles from './Ticker.module.css';

function TickerItem({ item }: { item: Resource }) {
  const content = (
    <>
      <span className={styles.kind}>{RESOURCE_KIND_LABELS[item.kind]}</span>
      {item.game ? <span className={styles.game}>{item.game.monogram}</span> : null}
      <span className={styles.title}>{item.title}</span>
    </>
  );
  return isExternal(item.url) ? (
    <a href={item.url} target="_blank" rel="noreferrer" className={styles.item}>
      {content}
    </a>
  ) : (
    <Link href={item.url} className={styles.item}>
      {content}
    </Link>
  );
}

/** Scrolling strip of live Radar items. Duplicated once so the loop is seamless. */
export function Ticker({ items }: { items: Resource[] }) {
  return (
    <div className={styles.ticker}>
      <span className={styles.live}>
        <span className={styles.dot} aria-hidden />
        Live radar
      </span>
      <div className={styles.viewport}>
        <div className={styles.track} style={{ animationDuration: `${Math.max(40, items.length * 9)}s` }}>
          {items.map((item) => (
            <TickerItem key={item.id} item={item} />
          ))}
          <span aria-hidden className={styles.copy}>
            {items.map((item) => (
              <TickerItem key={`copy-${item.id}`} item={item} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
