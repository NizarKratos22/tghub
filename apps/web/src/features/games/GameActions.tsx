'use client';

import type { CompatResult, GameSummary } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/primitives';
import { SESSION_KEY, useSession, useSignInHref } from '@/features/auth/session';
import { CompatResultView } from '@/features/pc/CompatResultView';
import { useT } from '@/i18n/I18nProvider';
import { componentName, isComplete, toHardware, useRigDraft } from '@/features/pc/rig';
import { api, ApiError } from '@/lib/api/client';
import styles from './GameActions.module.css';

const FAVORITES_KEY = ['bookmarks', 'game'] as const;

export function FavoriteButton({ gameId }: { gameId: string }) {
  const t = useT();
  const { data: me } = useSession();
  const router = useRouter();
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();

  const favorites = useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: () => api.me.bookmarkIds('game'),
    enabled: Boolean(me),
  });
  const isFavorite = favorites.data?.includes(gameId) ?? false;

  const toggle = useMutation({
    mutationFn: () => (isFavorite ? api.me.removeBookmark('game', gameId) : api.me.addBookmark('game', gameId)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = queryClient.getQueryData<string[]>(FAVORITES_KEY) ?? [];
      queryClient.setQueryData(FAVORITES_KEY, isFavorite ? previous.filter((id) => id !== gameId) : [...previous, gameId]);
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(FAVORITES_KEY, context?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FAVORITES_KEY });
      void queryClient.invalidateQueries({ queryKey: ['universe'] });
    },
  });

  return (
    <Button
      variant={isFavorite ? 'secondary' : 'outline'}
      icon="star"
      onClick={() => (me ? toggle.mutate() : router.push(signInHref))}
      aria-pressed={isFavorite}
      disabled={Boolean(me) && favorites.isPending}
    >
      {isFavorite ? t.games.following : t.games.favourite}
    </Button>
  );
}

/** Records one view per game per day for signed-in players (drives missions). */
export function ViewTracker({ slug }: { slug: string }) {
  const { data: me } = useSession();
  const queryClient = useQueryClient();
  const sent = useRef(false);
  useEffect(() => {
    if (!me || sent.current) return;
    sent.current = true;
    api.games
      .recordView(slug)
      .then(({ firstToday }) => {
        if (firstToday) void queryClient.invalidateQueries({ queryKey: ['universe'] });
      })
      .catch(() => undefined);
  }, [me, slug, queryClient]);
  return null;
}

/** Uses the rig from the PC Lab (saved primary rig, or the local draft) to judge this game. */
export function QuickCheck({ game }: { game: GameSummary }) {
  const t = useT();
  const { data: me } = useSession();
  const { rig, loaded } = useRigDraft();
  const specs = useQuery({ queryKey: ['pc', 'specs'], queryFn: api.pc.specs, enabled: Boolean(me) });
  const primary = specs.data?.find((spec) => spec.isPrimary) ?? specs.data?.[0];
  const queryClient = useQueryClient();

  const input = primary ? { specId: primary.id } : isComplete(rig) ? { spec: toHardware(rig) } : null;
  const rigLabel = primary ? `${primary.name}: ${componentName(primary.gpu)}` : isComplete(rig) ? componentName(rig.gpu) : null;

  const check = useQuery<CompatResult>({
    queryKey: ['pc', 'check', game.slug, input],
    queryFn: async () => {
      const result = await api.pc.check({ gameSlug: game.slug, ...input! });
      void queryClient.invalidateQueries({ queryKey: ['universe'] });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      return result;
    },
    enabled: Boolean(input),
    staleTime: 5 * 60_000,
  });

  if (!loaded || (me && specs.isPending)) return <Skeleton height={140} />;

  // A draft pointing at parts that left the index behaves like no rig at all.
  const staleDraft = check.error instanceof ApiError && Boolean(check.error.fields.cpuId || check.error.fields.gpuId);

  if (!input || staleDraft) {
    return (
      <div className={styles.empty}>
        <p>{t.games.setupText}</p>
        <ButtonLink href={`/pc?game=${game.slug}`} iconRight="arrowRight">
          {t.games.setup}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={styles.check}>
      <p className={styles.using}>
        {t.games.checkingWith} <strong>{rigLabel}</strong>
      </p>
      {check.data ? <CompatResultView result={check.data} compact /> : check.isError ? <p className={styles.error}>{check.error.message}</p> : <Skeleton height={140} />}
    </div>
  );
}
