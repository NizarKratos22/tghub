'use client';

import type { SavedSearch, SearchCriteria } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { useSession, useSignInHref } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api/client';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import styles from './SavedSearches.module.css';

export const SEARCHES_KEY = ['market', 'searches'] as const;

/** Browse URL for a saved search. */
function hrefFor(criteria: SearchCriteria): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(criteria)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  return `/market?${params}`;
}

/** On the browse page: saves the current filters, with alerts on. */
export function SaveSearchButton({ criteria }: { criteria: SearchCriteria }) {
  const t = useT();
  const { data: me } = useSession();
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<SavedSearch | null>(null);
  const save = useMutation({
    mutationFn: () => api.market.saveSearch({ criteria, notify: true }),
    onSuccess: (search) => {
      setSaved(search);
      void queryClient.invalidateQueries({ queryKey: SEARCHES_KEY });
    },
  });

  if (!me) {
    return (
      <Link href={signInHref} className={styles.saveButton}>
        <Icon name="bell" size={15} /> {t.market.saveSearch}
      </Link>
    );
  }
  if (saved) {
    return (
      <Link href="/market/searches" className={cx(styles.saveButton, styles.saveDone)}>
        <Icon name="check" size={15} /> {t.market.savedAlerts}
      </Link>
    );
  }
  return (
    <span className={styles.saveWrap}>
      <button type="button" className={styles.saveButton} onClick={() => save.mutate()} disabled={save.isPending}>
        <Icon name="bell" size={15} /> {save.isPending ? t.market.saving : t.market.saveSearch}
      </button>
      {save.error ? <span className={styles.saveError}>{save.error instanceof ApiError ? save.error.message : 'Could not save'}</span> : null}
    </span>
  );
}

function SearchRow({ search }: { search: SavedSearch }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(search.name);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: SEARCHES_KEY });
  const update = useMutation({ mutationFn: (body: { name?: string; notify?: boolean }) => api.market.updateSearch(search.id, body), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.market.deleteSearch(search.id), onSuccess: refresh });
  const open = async () => {
    await api.market.searchSeen(search.id).catch(() => undefined);
    refresh();
    router.push(hrefFor(search.criteria));
  };

  return (
    <li className={styles.row}>
      <button type="button" className={styles.open} onClick={open} aria-label={`Open ${search.name}`}>
        <span className={styles.searchIcon}>
          <Icon name="search" size={18} />
          {search.newCount > 0 ? <span className={styles.newBadge}>{search.newCount > 99 ? '99+' : search.newCount}</span> : null}
        </span>
      </button>
      <div className={styles.body}>
        {renaming ? (
          <form
            className={styles.rename}
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({ name }, { onSuccess: () => setRenaming(false) });
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Search name" autoFocus />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" className={styles.name} onClick={open}>
            {search.name}
          </button>
        )}
        <p className={styles.meta}>
          {search.newCount > 0 ? <strong>{search.newCount} new</strong> : 'Nothing new'} · saved <RelativeTime iso={search.createdAt} />
        </p>
        <FormError message={update.error?.message ?? remove.error?.message} />
      </div>
      <div className={styles.tools}>
        <button
          type="button"
          className={cx(styles.alertToggle, search.notify && styles.alertOn)}
          onClick={() => update.mutate({ notify: !search.notify })}
          aria-pressed={search.notify}
          title={search.notify ? 'Alerts on — tap to mute' : 'Alerts off — tap to turn on'}
        >
          <Icon name="bell" size={16} filled={search.notify} /> {search.notify ? 'Alerts on' : 'Muted'}
        </button>
        <button type="button" className={styles.iconButton} onClick={() => setRenaming(true)} aria-label="Rename">
          <Icon name="edit" size={16} />
        </button>
        <button type="button" className={styles.iconButton} onClick={() => remove.mutate()} aria-label="Delete saved search">
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  );
}

export function SavedSearchList() {
  const { data: me, isPending } = useSession();
  const searches = useQuery({ queryKey: SEARCHES_KEY, queryFn: api.market.searches, enabled: Boolean(me) });
  if (isPending || (me && searches.isPending)) return <Skeleton height={200} />;
  if (!me) return <EmptyState icon="bell" title="Sign in to save searches" action={<ButtonLink href="/login?next=/market/searches">Sign in</ButtonLink>} />;
  const items = searches.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState icon="bell" title="No saved searches yet" action={<ButtonLink href="/market">Browse the marketplace</ButtonLink>}>
        Filter the marketplace — a GPU under 1,500 TND, a QBCore script — then tap “Save search”. We&rsquo;ll alert you the moment a match is listed.
      </EmptyState>
    );
  }
  return (
    <ul className={styles.list}>
      {items.map((search) => (
        <SearchRow key={search.id} search={search} />
      ))}
    </ul>
  );
}
