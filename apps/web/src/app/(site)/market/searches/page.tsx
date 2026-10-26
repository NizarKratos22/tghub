import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { SavedSearchList } from '@/features/market/SavedSearches';
import styles from '../market.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.selling.searchesTitle };
}

export default async function SavedSearchesPage() {
  const t = await getT();
  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/searches" collapseOnMobile />
      <section className={styles.main} aria-labelledby="searches-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="searches-heading">{t.selling.searchesTitle}</h2>
            <p className={styles.meta}>{t.selling.searchesLede}</p>
          </div>
        </div>
        <SavedSearchList />
      </section>
    </div>
  );
}
