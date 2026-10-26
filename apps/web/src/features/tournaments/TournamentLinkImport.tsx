'use client';

import type { TournamentImportResult } from '@tgh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api/client';
import styles from './TournamentLinkImport.module.css';

/**
 * Paste a start.gg or FACEIT tournament link and it's mirrored here (TG Hub
 * never creates tournaments — organizers run them on those platforms).
 * Used across the admin and, for admins only, on public tournament lists.
 */
export function TournamentLinkImport({ hint }: { hint?: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<TournamentImportResult | null>(null);
  const importer = useMutation({
    mutationFn: () => api.admin.tournaments.import(url.trim()),
    onSuccess: (data) => {
      setResult(data);
      setUrl('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      // Server-rendered tournament lists on the current page pick it up.
      router.refresh();
    },
  });
  const fieldError = importer.error instanceof ApiError ? importer.error.fields.url : undefined;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        importer.mutate();
      }}
    >
      <TextField
        label="Tournament link"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://www.start.gg/tournament/… or https://www.faceit.com/…/championship/…"
        error={fieldError}
        hint={hint ?? 'start.gg or FACEIT. Already mirrored tournaments are refreshed instead.'}
      />
      <FormError message={importer.error && !fieldError ? importer.error.message : null} />
      <div className={styles.row}>
        <Button type="submit" size="sm" icon="plus" loading={importer.isPending} disabled={!url.trim()}>
          Add tournament
        </Button>
        {result ? (
          <p className={styles.result}>
            <Icon name="check" size={14} />
            {result.created ? 'Added' : 'Already here, refreshed'}: <Link href={`/tournaments/${result.tournament.slug}`}>{result.tournament.name}</Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** The same box folded behind a link, shown only to admins (public pages). */
export function AdminTournamentLinkImport() {
  const { data: me } = useSession();
  if (me?.role !== 'admin') return null;
  return (
    <details className={styles.admin}>
      <summary>
        <Icon name="plus" size={14} /> Add a tournament by link <span className={styles.badge}>Admin</span>
      </summary>
      <TournamentLinkImport />
    </details>
  );
}
