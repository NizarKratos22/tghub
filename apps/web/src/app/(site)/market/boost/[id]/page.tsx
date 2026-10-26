import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { OrderStatus } from '@/features/market/Boost';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.boost.orderTitle };
}

export default async function BoostOrderPage(props: PageProps<'/market/boost/[id]'>) {
  const { id } = await props.params;
  return (
    <div className="container page">
      <OrderStatus id={id} />
    </div>
  );
}
