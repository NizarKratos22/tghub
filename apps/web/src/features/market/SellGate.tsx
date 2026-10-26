'use client';

import { useQuery } from '@tanstack/react-query';
import type { ListingDetail } from '@tgh/shared';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { SignedIn } from '@/features/auth/session';
import { VerifyEmailNotice } from '@/features/auth/VerifyEmailBanner';
import { useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { ListingForm } from './ListingForm';
import { LISTING_KEYS } from './meta';

export function NewListing() {
  const t = useT();
  return (
    <SignedIn prompt={t.sell.signInPrompt} promptText={t.sell.signInText} loading={<Skeleton height={420} />}>
      {(me) => (me.emailVerified ? <ListingForm /> : <VerifyEmailNotice text={t.sell.verifyToSell} />)}
    </SignedIn>
  );
}

function OwnerOnly({ listing }: { listing: ListingDetail }) {
  const t = useT();
  const viewer = useQuery({ queryKey: LISTING_KEYS.viewer(listing.id), queryFn: () => api.market.viewer(listing.id) });
  if (viewer.isPending) return <Skeleton height={420} />;
  if (!viewer.data?.isOwner) {
    return (
      <EmptyState icon="lock" title={t.sell.ownerOnly} action={<ButtonLink href={`/market/item/${listing.id}`}>{t.sell.backToListing}</ButtonLink>} />
    );
  }
  return <ListingForm listing={listing} />;
}

export function EditListing({ listing }: { listing: ListingDetail }) {
  const t = useT();
  return (
    <SignedIn prompt={t.sell.signInToEdit} loading={<Skeleton height={420} />}>
      {() => <OwnerOnly listing={listing} />}
    </SignedIn>
  );
}
