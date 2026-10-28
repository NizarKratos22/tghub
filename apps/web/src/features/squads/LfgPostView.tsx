'use client';

import type { LfgPost, LfgRequest } from '@tgh/shared';
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
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { copyText } from '@/lib/clipboard';
import { cx } from '@/lib/cx';
import { Flag, SQUAD_KEYS } from './shared';
import styles from './LfgPostView.module.css';

function CopyContact({ contact }: { contact: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.contact}>
      <code>{contact}</code>
      <button
        type="button"
        onClick={() => {
          void copyText(contact).then((ok) => {
            if (!ok) return;
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
      >
        <Icon name={copied ? 'check' : 'link'} size={14} /> {copied ? t.lfg.copied : t.lfg.copy}
      </button>
    </div>
  );
}

function ApplyForm({ post, onDone }: { post: LfgPost; onDone: (post: LfgPost) => void }) {
  const t = useT();
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
      <TextField label={t.lfg.applyContact} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={80} error={fields.contact} hint={t.lfg.applyContactHint} required />
      <TextAreaField label={t.lfg.applyMessage} placeholder={t.lfg.applyPlaceholder} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={3} error={fields.message} />
      <FormError message={apply.error && Object.keys(fields).length === 0 ? apply.error.message : null} />
      <Button type="submit" block loading={apply.isPending} icon="send">
        {t.lfg.askToJoin}
      </Button>
    </form>
  );
}

/** What the visiting player sees in the side panel. */
function PlayerPanel({ post, onChange }: { post: LfgPost; onChange: (post: LfgPost) => void }) {
  const t = useT();
  const { data: me } = useSession();
  const withdraw = useMutation({ mutationFn: () => api.lfg.withdraw(post.id), onSuccess: onChange });

  if (!me) return <SignInPrompt title={t.lfg.signInToJoin}>{t.lfg.signInToJoinText}</SignInPrompt>;
  if (post.viewer.request === 'accepted') {
    return (
      <div className={cx(styles.state, styles.stateIn)}>
        <Icon name="check" size={22} />
        <strong>{t.lfg.inSquad}</strong>
        <span>{fill(t.lfg.reachHost, { name: post.author.displayName })}</span>
        {post.contact ? <CopyContact contact={post.contact} /> : null}
      </div>
    );
  }
  if (post.viewer.request === 'pending') {
    return (
      <div className={styles.state}>
        <Icon name="clock" size={22} />
        <strong>{t.lfg.requestSent}</strong>
        <span>{fill(t.lfg.requestSentText, { name: post.author.displayName })}</span>
        <Button variant="ghost" size="sm" onClick={() => withdraw.mutate()} loading={withdraw.isPending}>
          {t.lfg.withdraw}
        </Button>
      </div>
    );
  }
  if (post.viewer.request === 'declined') {
    return (
      <div className={styles.state}>
        <strong>{t.lfg.notThisTime}</strong>
        <span>{t.lfg.notThisTimeText}</span>
        <ButtonLink href={`/squads?game=${post.game.id}`} variant="outline" size="sm">
          {fill(t.lfg.moreSquads, { game: post.game.title })}
        </ButtonLink>
      </div>
    );
  }
  if (post.status !== 'open') {
    return (
      <div className={styles.state}>
        <strong>{post.status === 'full' ? t.lfg.isFull : t.lfg.isClosed}</strong>
        <ButtonLink href={`/squads?game=${post.game.id}`} variant="outline" size="sm">
          {t.lfg.findAnother}
        </ButtonLink>
      </div>
    );
  }
  if (!me.emailVerified) return <VerifyEmailNotice text={t.lfg.verifyToJoin} />;
  return <ApplyForm post={post} onDone={onChange} />;
}

function RequestRow({ request, onDecide, busy }: { request: LfgRequest; onDecide: (accept: boolean) => void; busy: boolean }) {
  const t = useT();
  return (
    <li className={cx(styles.request, request.status !== 'pending' && styles.requestDone)}>
      <Link href={`/u/${request.user.username}`} className={styles.requestWho}>
        <Avatar name={request.user.displayName} color={request.user.avatarColor} src={request.user.avatarUrl} size={36} />
        <span>
          <strong>{request.user.displayName}</strong>
          <span className={styles.requestMeta}>
            {fill(t.common.levelShort, { level: request.user.level })} <Flag country={request.user.country} /> · <RelativeTime iso={request.createdAt} />
          </span>
        </span>
      </Link>
      {request.message ? <p className={styles.requestMessage}>{request.message}</p> : null}
      {request.status === 'pending' ? (
        <div className={styles.requestActions}>
          <Button size="sm" onClick={() => onDecide(true)} disabled={busy} icon="check">
            {t.lfg.accept}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDecide(false)} disabled={busy}>
            {t.lfg.decline}
          </Button>
        </div>
      ) : request.status === 'accepted' ? (
        <div className={styles.requestAccepted}>
          <span className={styles.badgeIn}>{t.lfg.inTheSquad}</span>
          <code>{request.contact}</code>
        </div>
      ) : (
        <span className={styles.badgeOut}>{t.lfg.declined}</span>
      )}
    </li>
  );
}

/** The host's side: who asked, accept/decline, close the post. */
function HostPanel({ post, onChange }: { post: LfgPost; onChange: (post: LfgPost) => void }) {
  const t = useT();
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
        <h2>{t.lfg.requests} {pending > 0 ? <span className={styles.count}>{pending}</span> : null}</h2>
        {post.status === 'open' ? (
          <Button size="sm" variant="ghost" onClick={() => close.mutate()} loading={close.isPending}>
            {t.lfg.closePost}
          </Button>
        ) : null}
      </div>
      <FormError message={decide.error?.message ?? close.error?.message} />
      {requests.isPending ? (
        <Skeleton height={120} />
      ) : list.length === 0 ? (
        <p className={styles.muted}>{t.lfg.noRequests}</p>
      ) : (
        <ul className={styles.requests}>
          {list.map((request) => (
            <RequestRow key={request.id} request={request} busy={decide.isPending} onDecide={(accept) => decide.mutate({ id: request.id, accept })} />
          ))}
        </ul>
      )}
      <div className={styles.yourContact}>
        <span className={styles.muted}>{t.lfg.yourContact}</span>
        {post.contact ? <code>{post.contact}</code> : null}
      </div>
    </div>
  );
}

export function LfgPostView({ id }: { id: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const post = useQuery({ queryKey: SQUAD_KEYS.lfgPost(id), queryFn: () => api.lfg.get(id) });
  const update = (next: LfgPost) => {
    queryClient.setQueryData(SQUAD_KEYS.lfgPost(id), next);
    void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.lfg, exact: false });
  };

  if (post.isError) {
    return (
      <EmptyState icon="users" title={t.lfg.gone} action={<ButtonLink href="/squads">{t.lfg.backToBoard}</ButtonLink>}>
        {t.lfg.goneText}
      </EmptyState>
    );
  }
  if (!post.data) return <Skeleton height={360} />;
  const data = post.data;
  const left = Math.max(0, data.slots - data.filled);

  return (
    <div className={styles.layout}>
      <Link href="/squads" className={styles.back}>
        <Icon name="arrowLeft" size={16} /> {t.lfg.allSquads}
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
            <dt>{t.lfg.platform}</dt>
            <dd>{t.labels.platform[data.platform]}</dd>
          </div>
          <div>
            <dt>{t.lfg.squad}</dt>
            <dd>
              <span className={styles.seats} aria-hidden>
                {Array.from({ length: data.slots }, (_, i) => (
                  <span key={i} className={cx(styles.seat, i < data.filled && styles.seatFilled)} />
                ))}
              </span>
              {data.status === 'full' ? t.lfg.full : fill(t.lfg.openOf, { left, slots: data.slots })}
            </dd>
          </div>
          <div>
            <dt>{t.lfg.voice}</dt>
            <dd>
              {data.languages.map((l) => t.labels.lfgLanguage[l]).join(' · ')}
              {data.micRequired ? ` · ${t.lfg.micRequiredLower}` : ''}
            </dd>
          </div>
          <div>
            <dt>{data.status === 'open' ? t.lfg.closes : t.lfg.status}</dt>
            <dd>{data.status === 'open' ? <Countdown iso={data.expiresAt} label={t.lfg.closesInShort} endedLabel={t.lfg.closed} /> : data.status === 'full' ? t.lfg.squadFull : t.lfg.closed}</dd>
          </div>
        </dl>

        {data.note ? <p className={styles.note} dir="auto">{data.note}</p> : null}

        <footer className={styles.author}>
          <Link href={`/u/${data.author.username}`} className={styles.authorLink}>
            <Avatar name={data.author.displayName} color={data.author.avatarColor} src={data.author.avatarUrl} size={44} />
            <span>
              <strong>
                {data.author.clanTag ? <span className={styles.clan}>[{data.author.clanTag}]</span> : null}
                {data.author.displayName}
              </strong>
              <span className={styles.authorMeta}>
                {fill(t.common.level, { level: data.author.level })} <Flag country={data.author.country} /> · {t.lfg.posted} <RelativeTime iso={data.createdAt} />
              </span>
            </span>
          </Link>
        </footer>
      </article>

      <aside className={styles.side}>{data.viewer.isAuthor ? <HostPanel post={data} onChange={update} /> : <PlayerPanel post={data} onChange={update} />}</aside>
    </div>
  );
}
