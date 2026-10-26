import Link from 'next/link';
import { cx } from '@/lib/cx';
import styles from './Logo.module.css';

/**
 * Logo files in public/brand, made transparent and trimmed from the originals
 * in R2 (Tunisiagamerhub/tg-hub-*.png). Widths are for a height of 120.
 */
const FILES = {
  compact: { light: { src: '/brand/tg-hub-light-compact.webp', width: 392 }, dark: { src: '/brand/tg-hub-dark-compact.webp', width: 392 } },
  primary: { light: { src: '/brand/tg-hub-light-primary.webp', width: 400 }, dark: { src: '/brand/tg-hub-dark-primary.webp', width: 396 } },
};

/**
 * `compact` for the header, `primary` where there's room. `surface="dark"`
 * always uses the light-on-dark artwork (footer, admin sidebar); otherwise it
 * follows the site theme.
 */
export function Logo({
  variant = 'compact',
  surface = 'theme',
  href = '/',
  className,
  onClick,
}: {
  variant?: keyof typeof FILES;
  surface?: 'theme' | 'dark';
  href?: string;
  className?: string;
  onClick?: () => void;
}) {
  const files = FILES[variant];
  return (
    <Link href={href} className={cx(styles.logo, styles[variant], className)} aria-label="TG Hub home" onClick={onClick}>
      {surface === 'theme' ? <img src={files.light.src} width={files.light.width} height={120} alt="" className={styles.onLight} /> : null}
      <img src={files.dark.src} width={files.dark.width} height={120} alt="" className={surface === 'theme' ? styles.onDark : undefined} />
    </Link>
  );
}
