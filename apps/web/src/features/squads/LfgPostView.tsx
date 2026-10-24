'use client';

import { LFG_LANGUAGE_LABELS, PLATFORM_LABELS, type LfgPost, type LfgRequest } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FormError, TextAreaField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Countdown, RelativeTime } from '@/components/ui/time';
import { SignInPrompt, useSession } from '@/features/auth/session';
import { VerifyEmailNotice } from '@/features/auth/VerifyEmailBanner';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { Flag, SQUAD_KEYS } from './shared';
import styles from './LfgPostView.module.css';

function CopyContact({ contact }: { contact: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.contact}>
      <code>{contact}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(contact).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
      >
        <Icon name={copied ? 'check' : 'link'} size={14} /> {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function ApplyForm({ post, onDone }: { post: LfgPost; onDone: (post: LfgPost) => void }) {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const apply = useMutation({ mutationFn: () => api.lfg.apply(post.id, { message, contact }), onSuccess: onDone });
  const fields = apply.error instanceof ApiError ? apply.error.fields : {};
  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply.mutate();
  };
  return (
    <form className={styles.applyForm} onSubmit={submit}>
      <TextField label="Your Discord or in-game ID" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={80} error={fields.contact} hint="Only the host sees it." required />
      <TextAreaField label="Message (optional)" placeholder={`Your rank, role, when you can play…`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={3} error={fields.message} />
      <FormError message={apply.error && Object.keys(fields).length === 0 ? apply.error.message : null} />
      <Button type="submit" block loading={apply.isPending} icon="send">
        Ask to join
      </Button>
    </form>
  );
}

/** What the visiting player sees in the side panel. */
function PlayerPanel({ post, onChange }: { post: LfgPost; onChange: (post: LfgPost) => void }) {
  const { data: me } = useSession();
  const withdraw = useMutation({ mutationFn: () => api.lfg.withdraw(post.id), onSuccess: onChange });

  if (!me) return <SignInPrompt title="Sign in to join this squad">Hosts see your level and profile when you ask.</SignInPrompt>;
  if (post.viewer.request === 'accepted') {
    return (
      <div className={cx(styles.state, styles.stateIn)}>
        <Icon name="check" size={22} />
        <strong>You&rsquo;re in the squad</strong>
        <span>Reach {post.author.displayName} here:</span>
        {post.contact ? <CopyContact contact={post.contact} /> : null}
      </div>
    );
  }
  if (post.viewer.request === 'pending') {
    return (
      <div className={styles.state}>
        <Icon name="clock" size={22} />
        <strong>Request sent</strong>
        <span>{post.author.displayName} gets a notification and decides. You&rsquo;ll hear back here and on your phone if notifications are on.</span>
        <Button variant="ghost" size="sm" onClick={() => withdraw.mutate()} loading={withdraw.isPending}>
          Withdraw request
        </Button>
      </div>
    );
  }
  if (post.viewer.request === 'declined') {
    return (
      <div className={styles.state}>
        <strong>Not this time</strong>
        <span>The host picked other players. Plenty of squads are still looking.</span>
        <ButtonLink href={`/squads?game=${post.game.id}`} variant="outline" size="sm">
          More {post.game.title} squads
        </ButtonLink>
      </div>
    );
  }
  if (post.status !== 'open') {
    return (
      <div className={styles.state}>
        <strong>{post.status === 'full' ? 'This squad is full' : 'This post is closed'}</strong>
        <ButtonLink href={`/squads?game=${post.game.id}`} variant="outline" size="sm">
          Find another squad
        </ButtonLink>
      </div>
    );
  }
  if (!me.emailVerified) return <VerifyEmailNotice action="join squads" />;
  return <ApplyForm post={post} onDone={onChange} />;
}

function RequestRow({ request, onDecide, busy }: { request: LfgRequest; onDecide: (accept: boolean) => void; busy: boolean }) {
  return (
    <li className={cx(styles.request, request.status !== 'pending' && styles.requestDone)}>
      <Link href={`/u/${request.user.username}`} className={styles.requestWho}>
        <Avatar name={request.user.displayName} color={request.user.avatarColor} src={request.user.avatarUrl} size={36} />
        <span>
          <strong>{request.user.displayName}</strong>
          <span className={styles.requestMeta}>
            Lv {request.user.level} <Flag country={request.user.country} /> · <RelativeTime iso={request.createdAt} />
          </span>
        </span>
      </Link>
      {request.message ? <p className={styles.requestMessage}>{request.message}</p> : null}
      {request.status === 'pending' ? (
        <div className={styles.requestActions}>
          <Button size="sm" onClick={() => onDecide(true)} disabled={busy} icon="check">
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDecide(false)} disabled={busy}>
            Decline
          </Button>
        </div>
      ) : request.status === 'accepted' ? (
        <div className={styles.requestAccepted}>
          <span className={styles.badgeIn}>In the squad</span>
          <code>{request.contact}</code>
        </div>
      ) : (
        <span className={styles.badgeOut}>Declined</span>
      )}
    </li>
  );
}

/** The host's side: who asked, accept/decline, close the post. */
function HostPanel({ post, onChange }: { post: LfgPost; onChange: (post: LfgPost) => void }) {
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: SQUAD_KEYS.lfgRequests(post.id), queryFn: () => api.lfg.requests(post.id), refetchInterval: 30_000 });
  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api.lfg.decide(post.id, id, accept),
    onSuccess: (updated) => {
      queryClient.setQueryData(SQUAD_KEYS.lfgRequests(post.id), updated);
      void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.lfgPost(post.id) });
      void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.lfg });
    },
  });
  const close = useMutation({ mutationFn: () => api.lfg.close(post.id), onSuccess: onChange });
  const list = requests.data ?? [];
  const pending = list.filter((r) => r.status === 'pending').length;

  return (
    <div className={styles.host}>
      <div className={styles.hostHead}>
        <h2>Requests {pending > 0 ? <span className={styles.count}>{pending}</span> : null}</h2>
        {post.status === 'open' ? (
          <Button size="sm" variant="ghost" onClick={() => close.mutate()} loading={close.isPending}>
            Close post
          </Button>
        ) : null}
      </div>
      <FormError message={decide.error?.message ?? close.error?.message} />
      {requests.isPending ? (
        <Skeleton height={120} />
      ) : list.length === 0 ? (
        <p className={styles.muted}>No requests yet. You&rsquo;ll get a notification the moment someone asks.</p>
      ) : (
        <ul className={styles.requests}>
          {list.map((request) => (
            <RequestRow key={request.id} request={request} busy={decide.isPending} onDecide={(accept) => decide.mutate({ id: request.id, accept })} />
          ))}
        </ul>
      )}
      <div className={styles.yourContact}>
        <span className={styles.muted}>Accepted players see your contact:</span>
        {post.contact ? <code>{post.contact}</code> : null}
      </div>
    </div>
  );
}

export function LfgPostView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const post = useQuery({ queryKey: SQUAD_KEYS.lfgPost(id), queryFn: () => api.lfg.get(id) });
  const update = (next: LfgPost) => {
    queryClient.setQueryData(SQUAD_KEYS.lfgPost(id), next);
    void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.lfg, exact: false });
  };

  if (post.isError) {
    return (
      <EmptyState icon="users" title="This squad post is gone" action={<ButtonLink href="/squads">Back to the board</ButtonLink>}>
        It may have expired and been cleaned up.
      </EmptyState>
    );
  }
  if (!post.data) return <Skeleton height={360} />;
  const data = post.data;
  const left = Math.max(0, data.slots - data.filled);

  return (
    <div className={styles.layout}>
      <Link href="/squads" className={styles.back}>
        <Icon name="arrowLeft" size={16} /> All squads
      </Link>
      <article className={styles.main} style={{ '--accent': data.game.accent } as CSSProperties}>
        <header className={styles.band}>
          <span className={styles.monogram} aria-hidden>
            {data.game.monogram}
          </span>
          <div>
            <Link href={`/games/${data.game.slug}`} className={styles.game}>
              {data.game.title}
            </Link>
            <h1 className={styles.mode}>
              {data.mode}
              {data.rank ? <span className={styles.rank}>{data.rank}</span> : null}
            </h1>
          </div>
        </header>

        <dl className={styles.facts}>
          <div>
            <dt>Platform</dt>
            <dd>{PLATFORM_LABELS[data.platform]}</dd>
          </div>
          <div>
            <dt>Squad</dt>
            <dd>
              <span className={styles.seats} aria-hidden>
                {Array.from({ length: data.slots }, (_, i) => (
                  <span key={i} className={cx(styles.seat, i < data.filled && styles.seatFilled)} />
                ))}
              </span>
              {data.status === 'full' ? 'Full' : `${left} of ${data.slots} open`}
            </dd>
          </div>
          <div>
            <dt>Voice</dt>
            <dd>
              {data.languages.map((l) => LFG_LANGUAGE_LABELS[l]).join(', ')}
              {data.micRequired ? ' · mic required' : ''}
            </dd>
          </div>
          <div>
            <dt>{data.status === 'open' ? 'Closes' : 'Status'}</dt>
            <dd>{data.status === 'open' ? <Countdown iso={data.expiresAt} prefix="in" endedLabel="Closed" /> : data.status === 'full' ? 'Squad full' : 'Closed'}</dd>
          </div>
        </dl>

        {data.note ? <p className={styles.note}>{data.note}</p> : null}

        <footer className={styles.author}>
          <Link href={`/u/${data.author.username}`} className={styles.authorLink}>
            <Avatar name={data.author.displayName} color={data.author.avatarColor} src={data.author.avatarUrl} size={44} />
            <span>
              <strong>
                {data.author.clanTag ? <span className={styles.clan}>[{data.author.clanTag}]</span> : null}
                {data.author.displayName}
              </strong>
              <span className={styles.authorMeta}>
                Level {data.author.level} <Flag country={data.author.country} /> · posted <RelativeTime iso={data.createdAt} />
              </span>
            </span>
          </Link>
        </footer>
      </article>

      <aside className={styles.side}>{data.viewer.isAuthor ? <HostPanel post={data} onChange={update} /> : <PlayerPanel post={data} onChange={update} />}</aside>
    </div>
  );
}
