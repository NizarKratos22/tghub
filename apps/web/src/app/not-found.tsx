import { SiteChrome } from '@/components/layout/SiteChrome';
import { ButtonLink } from '@/components/ui/Button';
import styles from './status.module.css';

export default function NotFound() {
  // Unmatched URLs render outside every route group, so this page brings the site frame itself.
  return (
    <SiteChrome>
      <div className={`container ${styles.wrap}`}>
        <p className={styles.code}>ERR / 404</p>
        <h1 className={styles.title}>Out of bounds</h1>
        <p className={styles.text}>That page doesn&apos;t exist — or it respawned somewhere else.</p>
        <div className={styles.actions}>
          <ButtonLink href="/radar" icon="search">
            Search the Radar
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </SiteChrome>
  );
}
