'use client';

import type { TournamentStatus } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useSession, useSignInHref } from '@/features/auth/session';
import { api } from '@/lib/api/client';

const FOLLOWING_IDS = ['tournaments', 'following', 'ids'] as const;

export function useFollowingIds(enabled: boolean) {
  return useQuery({ queryKey: FOLLOWING_IDS, queryFn: api.tournaments.followingIds, enabled });
}

/**
 * Following = reminder subscription: registration closing within 24 h and
 * start within 1 h land in the player's inbox.
 */
export function FollowButton({
  tournamentId,
  slug,
  status,
  size = 'md',
}: {
  tournamentId: string;
  slug: string;
  status: TournamentStatus;
  size?: 'sm' | 'md';
}) {
  const { data: me } = useSession();
  const router = useRouter();
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const ids = useFollowingIds(Boolean(me));
  const following = ids.data?.includes(tournamentId) ?? false;

  const toggle = useMutation({
    mutationFn: () => (following ? api.tournaments.unfollow(slug) : api.tournaments.follow(slug)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: FOLLOWING_IDS });
      const previous = queryClient.getQueryData<string[]>(FOLLOWING_IDS) ?? [];
      queryClient.setQueryData(FOLLOWING_IDS, following ? previous.filter((id) => id !== tournamentId) : [...previous, tournamentId]);
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(FOLLOWING_IDS, context?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      void queryClient.invalidateQueries({ queryKey: ['universe'] });
    },
  });

  if (status === 'completed' || status === 'cancelled') return null;

  return (
    <Button
      size={size}
      variant={following ? 'secondary' : 'outline'}
      icon={following ? 'check' : 'bell'}
      aria-pressed={following}
      onClick={() => (me ? toggle.mutate() : router.push(signInHref))}
      disabled={Boolean(me) && ids.isPending}
      title={following ? 'You will get registration and start reminders' : 'Get registration and start reminders'}
    >
      {following ? 'Reminding' : 'Remind me'}
    </Button>
  );
}
