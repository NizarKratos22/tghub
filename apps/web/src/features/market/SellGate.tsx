'use client';

import { useQuery } from '@tanstack/react-query';
import type { ListingDetail } from '@tgh/shared';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { SignedIn } from '@/features/auth/session';
import { VerifyEmailNotice } from '@/features/auth/VerifyEmailBanner';
import { api } from '@/lib/api/client';
import { ListingForm } from './ListingForm';
import { LISTING_KEYS } from './meta';

export function NewListing() {
  return (
    <SignedIn prompt="Sign in to sell on TG Hub" promptText="Listing is free. Buyers message you directly — no fees, no middleman." loading={<Skeleton height={420} />}>
      {(me) => (me.emailVerified ? <ListingForm /> : <VerifyEmailNotice action="start selling" />)}
    </SignedIn>
  );
}

function OwnerOnly({ listing }: { listing: ListingDetail }) {
  const viewer = useQuery({ queryKey: LISTING_KEYS.viewer(listing.id), queryFn: () => api.market.viewer(listing.id) });
  if (viewer.isPending) return <Skeleton height={420} />;
  if (!viewer.data?.isOwner) {
    return (
      <EmptyState icon="lock" title="Only the seller can edit this listing" action={<ButtonLink href={`/market/item/${listing.id}`}>Back to listing</ButtonLink>} />
    );
  }
  return <ListingForm listing={listing} />;
}

export function EditListing({ listing }: { listing: ListingDetail }) {
  return (
    <SignedIn prompt="Sign in to edit your listing" loading={<Skeleton height={420} />}>
      {() => <OwnerOnly listing={listing} />}
    </SignedIn>
  );
}
