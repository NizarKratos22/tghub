import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import styles from './Defendr.module.css';

/** TG Hub is fully funded and powered by DEFENDR.GG, an esports tournament platform. */
export const DEFENDR_URL = 'https://defendr.gg/';

/** Their wordmark (public/brand/defendr.png, from DEFENDR's own assets): transparent, reads on light and dark. */
export function DefendrLogo({ className }: { className?: string }) {
  return <img src="/brand/defendr.png" width={996} height={173} alt="DEFENDR" className={cx(styles.logo, className)} />;
}

/** One line for footers and sidebars: "Fully funded and powered by DEFENDR ↗". */
export function PoweredByDefendr({ label, className }: { label: string; className?: string }) {
  return (
    <a href={DEFENDR_URL} target="_blank" rel="noopener" className={cx(styles.powered, className)}>
      <span>{label}</span>
      <DefendrLogo />
      <Icon name="arrowUpRight" size={14} />
    </a>
  );
}

/** Home page partner card with the call to action. */
export function DefendrBand({ kicker, title, text, cta }: { kicker: string; title: string; text: string; cta: string }) {
  return (
    <section className={styles.band} aria-labelledby="defendr-title">
      <div className={styles.bandText}>
        <p className={styles.kicker}>{kicker}</p>
        <h2 id="defendr-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.text}>{text}</p>
      </div>
      <div className={styles.bandSide}>
        <DefendrLogo className={styles.bandLogo} />
        <a href={DEFENDR_URL} target="_blank" rel="noopener" className={styles.cta}>
          {cta}
          <Icon name="arrowUpRight" size={16} />
        </a>
      </div>
    </section>
  );
}
