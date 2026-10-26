'use client';

import type { Me } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { SESSION_KEY } from '@/lib/query-keys';

export { SESSION_KEY };

/** Set by the API next to the httpOnly refresh cookie; holds no secret. */
const hasSessionHint = () => typeof document !== 'undefined' && /(?:^|;\s*)tgh_session=/.test(document.cookie);

/** The signed-in player, `null` for guests, `undefined` while loading. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async (): Promise<Me | null> => {
      // Guests have no session cookie: skip the /me → /auth/refresh round trip entirely.
      if (!hasSessionHint()) return null;
      try {
        return await api.me.get();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    // Signed-in players poll so unread counts and level-ups (XP is granted server-side) stay current.
    refetchInterval: (query) => (query.state.data ? 60_000 : false),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
      router.push('/');
      router.refresh();
    },
  });
}

export function useSignInHref(): string {
  const pathname = usePathname();
  return `/login?next=${encodeURIComponent(pathname)}`;
}

export function SignInPrompt({ title, children }: { title: string; children?: ReactNode }) {
  const t = useT();
  const signInHref = useSignInHref();
  return (
    <EmptyState
      icon="user"
      title={title}
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ButtonLink href={signInHref}>{t.meta.signIn}</ButtonLink>
          <ButtonLink href="/register" variant="outline">
            {t.meta.register}
          </ButtonLink>
        </div>
      }
    >
      {children}
    </EmptyState>
  );
}

/** Renders `children(me)` for signed-in players, a prompt for guests. */
export function SignedIn({
  children,
  prompt,
  promptText,
  loading,
}: {
  children: (me: Me) => ReactNode;
  prompt?: string;
  promptText?: ReactNode;
  loading?: ReactNode;
}) {
  const t = useT();
  const { data: me, isPending } = useSession();
  if (isPending) return <>{loading ?? <Skeleton height={160} />}</>;
  if (!me) return <SignInPrompt title={prompt ?? t.recover.signInPrompt}>{promptText}</SignInPrompt>;
  return <>{children(me)}</>;
}
