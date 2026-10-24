import type { Metadata } from 'next';
import { OrderStatus } from '@/features/market/Boost';

export const metadata: Metadata = { title: 'Featured listing order' };

export default async function BoostOrderPage(props: PageProps<'/market/boost/[id]'>) {
  const { id } = await props.params;
  return (
    <div className="container page">
      <OrderStatus id={id} />
    </div>
  );
}
