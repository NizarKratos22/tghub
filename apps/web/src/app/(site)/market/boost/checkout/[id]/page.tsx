import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { notFound } from 'next/navigation';
import { DevCheckout } from '@/features/market/Boost';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.boost.testCheckout, robots: { index: false } };
}

/** Development only: stands in for the payment provider's page. */
export default async function DevCheckoutPage(props: PageProps<'/market/boost/checkout/[id]'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { id } = await props.params;
  return (
    <div className="container page">
      <DevCheckout id={id} />
    </div>
  );
}
