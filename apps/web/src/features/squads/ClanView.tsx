'use client';

import { CLAN_JOIN_POLICY_META, countryName, MAX_CLAN_MEMBERS, type ClanDetail, type ClanMember } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { useSession, useSignInHref } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatDateYear, formatNumber } from '@/lib/format';
import { ClanFields } from './ClanForm';
import { ClanEmblem, Flag, RoleBadge, SQUAD_KEYS } from './shared';
import styles from './ClanView.module.css';

type Tab = 'members' | 'requests' | 'settings';

function useClanMutation<T>(tag: string, fn: (value: T) => Promise<ClanDetail | void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (clan) => {
      if (clan) queryClient.setQueryData(SQUAD_KEYS.clan(tag), clan);
      else void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.clan(tag) });
      void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.myClan });
      void queryClient.invalidateQueries({ queryKey: ['clans', 'list'] });
    },
  });
}

/** Join, apply, withdraw or leave — whatever fits the viewer. */
function JoinPanel({ clan }: { clan: ClanDetail }) {
  const { data: me } = useSession();
  const signInHref = useSignInHref();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [composing, setComposing] = useState(false);
  const join = useClanMutation(clan.tag, () => api.clans.join(clan.tag, message));
  const withdraw = useClanMutation(clan.tag, () => api.clans.withdraw(clan.tag));
  const leave = useClanMutation(clan.tag, async () => {
    await api.clans.leave(clan.tag);
    if (clan.memberCount <= 1) router.push('/clans');
  });
  const error = join.error ?? withdraw.error ?? leave.error;
  const full = clan.memberCount >= MAX_CLAN_MEMBERS;

  let body;
  if (!me) {
    body = (
      <ButtonLink href={signInHref} block>
        Sign in to join
      </ButtonLink>
    );
  } else if (clan.viewer.role === 'owner' && clan.memberCount > 1) {
    body = <p className={styles.panelText}>You lead this clan. To leave it, make another member leader first (Members → ⋯).</p>;
  } else if (clan.viewer.role) {
    const owner = clan.viewer.role === 'owner';
    body = (
      <>
        <p className={styles.panelText}>
          You&rsquo;re {owner ? 'the leader' : `${clan.viewer.role === 'officer' ? 'an officer' : 'a member'}`} of this clan.
        </p>
        <Button
          variant="ghost"
          size="sm"
          loading={leave.isPending}
          onClick={() => {
            const question = owner && clan.memberCount <= 1 ? 'You are the last member — leaving disbands the clan. Continue?' : `Leave [${clan.tag}] ${clan.name}?`;
            if (window.confirm(question)) leave.mutate(undefined);
          }}
        >
          {owner && clan.memberCount <= 1 ? 'Leave and disband' : 'Leave clan'}
        </Button>
      </>
    );
  } else if (clan.viewer.otherClan) {
    body = (
      <p className={styles.panelText}>
        You&rsquo;re in{' '}
        <Link href={`/clans/${clan.viewer.otherClan.tag}`}>
          [{clan.viewer.otherClan.tag}] {clan.viewer.otherClan.name}
        </Link>
        . Players can be in one clan at a time.
      </p>
    );
  } else if (clan.viewer.requestPending) {
    body = (
      <>
        <p className={styles.panelText}>
          <Icon name="clock" size={15} /> Application sent. The leader and officers have been notified.
        </p>
        <Button variant="ghost" size="sm" loading={withdraw.isPending} onClick={() => withdraw.mutate(undefined)}>
          Withdraw application
        </Button>
      </>
    );
  } else if (full || clan.joinPolicy === 'closed') {
    body = <p className={styles.panelText}>{full ? 'This clan is full.' : 'This clan isn’t recruiting right now.'}</p>;
  } else if (!me.emailVerified) {
    body = (
      <ButtonLink href="/verify-email" variant="outline" block>
        Confirm your email to join
      </ButtonLink>
    );
  } else if (clan.joinPolicy === 'open') {
    body = (
      <Button block icon="plus" loading={join.isPending} onClick={() => join.mutate(undefined)}>
        Join clan
      </Button>
    );
  } else if (composing) {
    body = (
      <div className={styles.apply}>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={3} placeholder="Say hi — your rank, main role, when you play…" aria-label="Message to the clan" autoFocus />
        <div className={styles.applyActions}>
          <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
            Cancel
          </Button>
          <Button size="sm" icon="send" loading={join.isPending} onClick={() => join.mutate(undefined)}>
            Send application
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <Button block icon="send" onClick={() => setComposing(true)}>
        Apply to join
      </Button>
    );
  }

  return (
    <div className={styles.panel}>
      {body}
      <FormError message={error?.message} />
    </div>
  );
}

/** "⋯" menu with what the viewer may do to this member. */
function MemberMenu({ clan, member }: { clan: ClanDetail; member: ClanMember }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const userId = member.user.id;
  const setRole = useClanMutation(clan.tag, (role: 'officer' | 'member') => api.clans.setRole(clan.tag, userId, role));
  const makeLeader = useClanMutation(clan.tag, () => api.clans.makeLeader(clan.tag, userId));
  const remove = useClanMutation(clan.tag, () => api.clans.remove(clan.tag, userId));
  const error = setRole.error ?? makeLeader.error ?? remove.error;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const viewer = clan.viewer.role;
  const isOwner = viewer === 'owner';
  const canRemove = (viewer === 'owner' && member.role !== 'owner') || (viewer === 'officer' && member.role === 'member');
  if (member.role === 'owner' || (!isOwner && !canRemove)) return null;

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <div className={styles.menuWrap} ref={ref}>
      <button type="button" className={styles.menuButton} onClick={() => setOpen((v) => !v)} aria-label={`Manage ${member.user.displayName}`} aria-expanded={open}>
        <Icon name="more" size={18} />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          {isOwner && member.role === 'member' ? (
            <button type="button" role="menuitem" onClick={() => run(() => setRole.mutate('officer'))}>
              <Icon name="shield" size={15} /> Make officer
            </button>
          ) : null}
          {isOwner && member.role === 'officer' ? (
            <button type="button" role="menuitem" onClick={() => run(() => setRole.mutate('member'))}>
              <Icon name="user" size={15} /> Make member
            </button>
          ) : null}
          {isOwner ? (
            <button type="button" role="menuitem" onClick={() => run(() => window.confirm(`Hand leadership to ${member.user.displayName}? You'll become an officer.`) && makeLeader.mutate(undefined))}>
              <Icon name="star" size={15} /> Make leader
            </button>
          ) : null}
          {canRemove ? (
            <button type="button" role="menuitem" className={styles.menuDanger} onClick={() => run(() => window.confirm(`Remove ${member.user.displayName} from the clan?`) && remove.mutate(undefined))}>
              <Icon name="close" size={15} /> Remove from clan
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <span className={styles.menuError}>{error.message}</span> : null}
    </div>
  );
}

function Members({ clan }: { clan: ClanDetail }) {
  return (
    <ul className={styles.members}>
      {clan.members.map((member) => (
        <li key={member.user.id || member.joinedAt} className={styles.member}>
          <Link href={member.user.username ? `/u/${member.user.username}` : '#'} className={styles.memberLink}>
            <Avatar name={member.user.displayName} color={member.user.avatarColor} src={member.user.avatarUrl} size={40} />
            <span className={styles.memberText}>
              <strong>{member.user.displayName}</strong>
              <span>
                Lv {member.user.level} <Flag country={member.user.country} /> · joined <RelativeTime iso={member.joinedAt} />
              </span>
            </span>
          </Link>
          <RoleBadge role={member.role} />
          <MemberMenu clan={clan} member={member} />
        </li>
      ))}
    </ul>
  );
}

function Requests({ clan }: { clan: ClanDetail }) {
  const decide = useClanMutation(clan.tag, ({ id, accept }: { id: string; accept: boolean }) => api.clans.decide(clan.tag, id, accept));
  if (clan.requests.length === 0) return <p className={styles.muted}>No applications waiting. You&rsquo;ll get a notification when someone applies.</p>;
  return (
    <>
      <FormError message={decide.error?.message} />
      <ul className={styles.requests}>
        {clan.requests.map((request) => (
          <li key={request.id} className={styles.request}>
            <Link href={`/u/${request.user.username}`} className={styles.memberLink}>
              <Avatar name={request.user.displayName} color={request.user.avatarColor} src={request.user.avatarUrl} size={40} />
              <span className={styles.memberText}>
                <strong>{request.user.displayName}</strong>
                <span>
                  Lv {request.user.level} <Flag country={request.user.country} /> · <RelativeTime iso={request.createdAt} />
                </span>
              </span>
            </Link>
            {request.message ? <p className={styles.requestMessage}>&ldquo;{request.message}&rdquo;</p> : null}
            <div className={styles.requestActions}>
              <Button size="sm" icon="check" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, accept: true })}>
                Accept
              </Button>
              <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, accept: false })}>
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Settings({ clan, onSaved }: { clan: ClanDetail; onSaved: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const disband = useMutation({
    mutationFn: () => api.clans.disband(clan.tag),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.clans });
      router.push('/clans');
    },
  });
  return (
    <div className={styles.settings}>
      <ClanFields initial={clan} submitLabel="Save changes" onSaved={onSaved} />
      {clan.viewer.role === 'owner' ? (
        <div className={styles.danger}>
          <div>
            <strong>Disband clan</strong>
            <span>Removes the clan and every membership. This can&rsquo;t be undone.</span>
          </div>
          <Button variant="danger" size="sm" loading={disband.isPending} onClick={() => window.confirm(`Disband [${clan.tag}] ${clan.name} for good?`) && disband.mutate()}>
            Disband
          </Button>
          <FormError message={disband.error?.message} />
        </div>
      ) : null}
    </div>
  );
}

export function ClanView({ tag }: { tag: string }) {
  const clan = useQuery({ queryKey: SQUAD_KEYS.clan(tag), queryFn: () => api.clans.get(tag) });
  const [tab, setTab] = useState<Tab>('members');

  if (clan.isError) {
    return (
      <div className="container page">
        <EmptyState icon="shield" title="Clan not found" action={<ButtonLink href="/clans">Browse clans</ButtonLink>}>
          It may have been disbanded, or the tag changed hands.
        </EmptyState>
      </div>
    );
  }
  if (!clan.data) {
    return (
      <div className="container page">
        <Skeleton height={320} />
      </div>
    );
  }
  const data = clan.data;
  const manager = data.viewer.role === 'owner' || data.viewer.role === 'officer';
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'members', label: 'Members', count: data.memberCount },
    ...(manager ? [{ id: 'requests' as const, label: 'Applications', count: data.requests.length }, { id: 'settings' as const, label: 'Settings' }] : []),
  ];

  return (
    <>
      <section className={styles.hero} style={{ '--clan': data.color } as CSSProperties}>
        <div className={`container ${styles.heroGrid}`}>
          <ClanEmblem tag={data.tag} color={data.color} size={112} className={styles.heroEmblem} />
          <div className={styles.identity}>
            <p className={styles.kicker}>
              [{data.tag}] · {data.country ? countryName(data.country) : 'Worldwide'} · since {formatDateYear(data.createdAt)}
            </p>
            <h1 className={styles.name}>{data.name}</h1>
            {data.description ? <p className={styles.description}>{data.description}</p> : null}
            {data.games.length > 0 ? (
              <div className={styles.games}>
                {data.games.map((game) => (
                  <Link key={game.id} href={`/games/${game.slug}`} className={styles.game} style={{ '--accent': game.accent } as CSSProperties}>
                    <span>{game.monogram}</span>
                    {game.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <JoinPanel clan={data} />
        </div>
        <div className={`container ${styles.stats}`}>
          <div>
            <span className="label">Season XP</span>
            <strong>{formatNumber(data.seasonXp)}</strong>
          </div>
          <div>
            <span className="label">All-time XP</span>
            <strong>{formatNumber(data.xp)}</strong>
          </div>
          <div>
            <span className="label">Members</span>
            <strong>
              {data.memberCount}
              <small>/{MAX_CLAN_MEMBERS}</small>
            </strong>
          </div>
          <div>
            <span className="label">Recruiting</span>
            <strong className={styles.policyStat}>{data.memberCount >= MAX_CLAN_MEMBERS ? 'Full' : CLAN_JOIN_POLICY_META[data.joinPolicy].label}</strong>
          </div>
        </div>
      </section>

      <div className="container page">
        <div className={styles.tabs} role="tablist" aria-label="Clan">
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={cx(styles.tab, tab === item.id && styles.tabOn)} onClick={() => setTab(item.id)}>
              {item.label}
              {item.count !== undefined ? <span className={cx(styles.tabCount, item.id === 'requests' && item.count > 0 && styles.tabAlert)}>{item.count}</span> : null}
            </button>
          ))}
        </div>
        <div className={styles.tabBody}>
          {tab === 'members' ? <Members clan={data} /> : tab === 'requests' && manager ? <Requests clan={data} /> : manager ? <Settings clan={data} onSaved={() => setTab('members')} /> : null}
        </div>
      </div>
    </>
  );
}
