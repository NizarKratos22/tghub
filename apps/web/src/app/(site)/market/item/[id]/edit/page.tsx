import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ListingDetail } from '@tgh/shared';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { EditListing } from '@/features/market/SellGate';
import { serverApi } from '@/lib/api/server';
import styles from '../../../market.module.css';

export const metadata: Metadata = { title: 'Edit listing' };

export default async function EditListingPage(props: PageProps<'/market/item/[id]/edit'>) {
  const { id } = await props.params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const listing = await serverApi<ListingDetail>(`/market/listings/${id}`);

  return (
    <div className={styles.shell}>
      <MarketSidebar active="/market/selling" collapseOnMobile />
      <section className={`${styles.main} ${styles.mainNarrow}`} aria-labelledby="edit-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="edit-heading">Edit listing</h2>
            <p className={styles.meta}>{listing.title}</p>
          </div>
        </div>
        <EditListing listing={listing} />
      </section>
    </div>
  );
}
