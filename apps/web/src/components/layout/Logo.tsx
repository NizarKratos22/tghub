import Link from 'next/link';
import styles from './Logo.module.css';

export function Logo() {
  return (
    <Link href="/" className={styles.logo} aria-label="TG Hub home">
      <span className={styles.mark}>TG</span>
      <span className={styles.word}>
        HUB<span className={styles.region}>TN</span>
      </span>
    </Link>
  );
}
