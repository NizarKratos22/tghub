import { SiteChrome } from '@/components/layout/SiteChrome';
import { ButtonLink } from '@/components/ui/Button';
import { getT } from '@/i18n/server';
import styles from './status.module.css';

export default async function NotFound() {
  const t = await getT();
  // Unmatched URLs render outside every route group, so this page brings the site frame itself.
  return (
    <SiteChrome>
      <div className={`container ${styles.wrap}`}>
        <p className={styles.code}>ERR / 404</p>
        <h1 className={styles.title}>{t.errors.notFoundTitle}</h1>
        <p className={styles.text}>{t.errors.notFoundText}</p>
        <div className={styles.actions}>
          <ButtonLink href="/radar" icon="search">
            {t.errors.searchRadar}
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            {t.errors.home}
          </ButtonLink>
        </div>
      </div>
    </SiteChrome>
  );
}
