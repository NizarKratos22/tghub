'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { LISTING_STATUS_LABELS, type ConversationSummary, type CursorPage, type MarketMessage } from '@tgh/shared';
import { Icon } from '@/components/ui/Icon';
import { Avatar, EmptyState, Skeleton, Tag } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { useRealtimeConnected, useRealtimeEvent } from '@/features/realtime/RealtimeProvider';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatDate, formatTime, formatTnd } from '@/lib/format';
import { LISTING_KEYS } from './meta';
import styles from './Inbox.module.css';

type Role = 'all' | 'buying' | 'selling';
const TABS: Array<{ value: Role; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'buying', label: 'Buying' },
  { value: 'selling', label: 'Selling' },
];

/** Send "typing…" at most this often; the other side shows it for a little longer. */
const TYPING_PING_MS = 3_000;
const TYPING_SHOW_MS = 6_000;

const SELLER_REPLIES = ["Yes, it's still available", 'Where would you like to meet?', "Sorry, it's been sold"];
const BUYER_REPLIES = ['Is the price negotiable?', 'Can you send more photos?', 'When can we meet?'];

function ListingThumb({ conversation, size = 52 }: { conversation: ConversationSummary; size?: number }) {
  return (
    <span className={styles.thumb} style={{ width: size, height: size }}>
      {conversation.listing.photo ? <img src={conversation.listing.photo.thumbUrl} alt="" width={size} height={size} /> : <Icon name="image" size={20} />}
      <span className={styles.thumbAvatar}>
        <Avatar name={conversation.counterpart.displayName} color={conversation.counterpart.avatarColor} src={conversation.counterpart.avatarUrl} size={22} />
      </span>
    </span>
  );
}

function ConversationList({ activeId }: { activeId?: string }) {
  const [role, setRole] = useState<Role>('all');
  const live = useRealtimeConnected();
  const conversations = useQuery({
    queryKey: LISTING_KEYS.conversations(role),
    queryFn: () => api.market.conversations(role),
    // Live events refresh the list; polling is only the fallback.
    refetchInterval: live ? 120_000 : 15_000,
  });

  return (
    <div className={styles.listPane}>
      <div className={styles.listHead}>
        <h2>Chats</h2>
        <div className={styles.tabs} role="tablist" aria-label="Filter chats">
          {TABS.map((tab) => (
            <button key={tab.value} type="button" role="tab" aria-selected={role === tab.value} className={cx(styles.tab, role === tab.value && styles.tabOn)} onClick={() => setRole(tab.value)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {conversations.isPending ? (
        <div className={styles.listBody}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </div>
      ) : (conversations.data ?? []).length === 0 ? (
        <p className={styles.listEmpty}>{role === 'selling' ? 'No buyers have messaged you yet.' : role === 'buying' ? "You haven't messaged any sellers yet." : 'No chats yet.'}</p>
      ) : (
        <ul className={styles.listBody}>
          {conversations.data!.map((conversation) => (
            <li key={conversation.id}>
              <Link href={`/market/inbox/${conversation.id}`} className={cx(styles.item, conversation.id === activeId && styles.itemOn, conversation.unread > 0 && styles.unread)}>
                <ListingThumb conversation={conversation} />
                <span className={styles.itemText}>
                  <span className={styles.itemTop}>
                    <span className={styles.itemName}>
                      {conversation.counterpart.displayName} · {conversation.listing.title}
                    </span>
                  </span>
                  <span className={styles.itemPreview}>
                    {conversation.lastMessage ? `${conversation.lastMessage.mine ? 'You: ' : ''}${conversation.lastMessage.body}` : 'No messages yet'}
                  </span>
                  <span className={styles.itemMeta}>
                    <span className={cx(styles.roleTag, conversation.role === 'seller' && styles.roleSeller)}>{conversation.role === 'seller' ? 'Selling' : 'Buying'}</span>
                    <RelativeTime iso={conversation.updatedAt} />
                  </span>
                </span>
                {conversation.unread > 0 ? <span className={styles.unreadDot} aria-label={`${conversation.unread} unread`}>{conversation.unread}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Groups consecutive messages by day for the separators. */
function withDays(messages: MarketMessage[]) {
  let lastDay = '';
  return messages.map((message) => {
    const day = formatDate(message.createdAt);
    const showDay = day !== lastDay;
    lastDay = day;
    return { message, showDay, day };
  });
}

/** "typing…" from the other side, cleared after a pause or when their message lands. */
function useCounterpartTyping(id: string) {
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback(() => {
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTyping(false), TYPING_SHOW_MS);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setTyping(false);
  }, []);
  return { typing, show, hide, id };
}

function Thread({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [older, setOlder] = useState<MarketMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastTypingPing = useRef(0);
  const live = useRealtimeConnected();
  const counterpartTyping = useCounterpartTyping(id);

  const conversation = useQuery({ queryKey: LISTING_KEYS.conversation(id), queryFn: () => api.market.conversation(id), refetchInterval: live ? false : 30_000 });
  // New messages arrive on the live stream; the newest page only polls while it's down.
  // Older pages are fetched on demand and kept locally.
  const latest = useQuery({ queryKey: LISTING_KEYS.messages(id), queryFn: () => api.market.messages(id), refetchInterval: live ? false : 5_000 });

  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...older, ...(latest.data?.items ?? [])].filter((message) => (seen.has(message.id) ? false : (seen.add(message.id), true)));
  }, [older, latest.data]);
  const cursor = olderCursor === undefined ? (latest.data?.nextCursor ?? null) : olderCursor;

  const markRead = useMutation({
    mutationFn: () => api.market.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      void queryClient.invalidateQueries({ queryKey: ['market', 'conversations'] });
    },
  });
  const lastMessageId = messages.at(-1)?.id;
  const unread = conversation.data?.unread ?? 0;
  // "Seen" must mean seen: a thread open in a background tab isn't read until the tab is looked at.
  useEffect(() => {
    const needsRead = unread > 0 || (lastMessageId && !messages.at(-1)?.mine);
    if (!needsRead) return;
    if (document.visibilityState === 'visible') {
      markRead.mutate();
      return;
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') markRead.mutate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // Only re-run when something new arrives, not on every render of the mutation object.
  }, [lastMessageId, unread]);

  useRealtimeEvent((event) => {
    if (event.type === 'market.typing' && event.data.conversationId === id) {
      counterpartTyping.show();
      return;
    }
    if (event.type !== 'market.message' || event.data.conversationId !== id) return;
    const { message } = event.data;
    if (!message.mine) counterpartTyping.hide();
    queryClient.setQueryData<CursorPage<MarketMessage>>(LISTING_KEYS.messages(id), (page) =>
      page && !page.items.some((m) => m.id === message.id) ? { ...page, items: [...page.items, message] } : page,
    );
  });

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, counterpartTyping.typing]);

  const onDraftChange = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingPing.current > TYPING_PING_MS) {
      lastTypingPing.current = now;
      api.market.typing(id).catch(() => undefined);
    }
  };

  const send = useMutation({
    mutationFn: (body: string) => api.market.send(id, body),
    onSuccess: (message) => {
      setDraft('');
      lastTypingPing.current = 0;
      stickToBottom.current = true;
      queryClient.setQueryData<CursorPage<MarketMessage>>(LISTING_KEYS.messages(id), (page) =>
        page ? { ...page, items: [...page.items.filter((m) => m.id !== message.id), message] } : page,
      );
      void queryClient.invalidateQueries({ queryKey: ['market', 'conversations'] });
    },
  });

  const loadOlder = useMutation({
    mutationFn: () => api.market.messages(id, cursor ?? undefined),
    onSuccess: (page) => {
      stickToBottom.current = false;
      setOlder((current) => [...page.items, ...current]);
      setOlderCursor(page.nextCursor);
    },
  });

  const submit = () => {
    const body = draft.trim();
    if (body && !send.isPending) send.mutate(body);
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  if (conversation.isError) {
    return (
      <div className={styles.threadEmpty}>
        <EmptyState icon="message" title="Conversation not found">
          It may have been removed, or it belongs to another account.
        </EmptyState>
      </div>
    );
  }

  const data = conversation.data;
  const closed = data ? data.listing.status === 'removed' || data.listing.status === 'deleted' : false;
  const replies = data?.role === 'seller' ? SELLER_REPLIES : BUYER_REPLIES;
  // Messenger-style receipt under your latest message only.
  const lastOwn = messages.at(-1)?.mine ? messages.at(-1) : undefined;
  const seen = Boolean(lastOwn && data?.counterpartReadAt && data.counterpartReadAt >= lastOwn.createdAt);

  return (
    <div className={styles.thread}>
      <header className={styles.threadHead}>
        <Link href="/market/inbox" className={styles.back} aria-label="Back to chats">
          <Icon name="arrowLeft" size={20} />
        </Link>
        {data ? (
          <>
            <Link href={closed ? '#' : `/market/item/${data.listing.id}`} className={styles.threadListing} aria-disabled={closed}>
              <ListingThumb conversation={data} size={44} />
              <span className={styles.threadText}>
                <span className={styles.threadTitle}>{data.listing.title}</span>
                <span className={styles.threadSub}>
                  {formatTnd(data.listing.price)} · {data.role === 'seller' ? 'Buyer' : 'Seller'}: <strong>{data.counterpart.displayName}</strong>
                </span>
              </span>
            </Link>
            {data.listing.status !== 'active' ? <Tag tone={data.listing.status === 'sold' ? 'solid' : 'gold'}>{LISTING_STATUS_LABELS[data.listing.status]}</Tag> : null}
          </>
        ) : (
          <Skeleton height={44} />
        )}
      </header>

      <div
        className={styles.messages}
        ref={scroller}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        aria-live="polite"
      >
        {cursor ? (
          <button type="button" className={styles.older} onClick={() => loadOlder.mutate()} disabled={loadOlder.isPending}>
            {loadOlder.isPending ? 'Loading…' : 'Load earlier messages'}
          </button>
        ) : null}
        {latest.isPending ? <Skeleton height={120} /> : null}
        {withDays(messages).map(({ message, showDay, day }) => (
          <div key={message.id} className={styles.messageRow}>
            {showDay ? <p className={styles.day}>{day}</p> : null}
            <div className={cx(styles.bubbleWrap, message.mine && styles.mine)}>
              <p className={styles.bubble}>{message.body}</p>
              <time className={styles.time} dateTime={message.createdAt}>
                {formatTime(message.createdAt)}
              </time>
            </div>
            {message === lastOwn ? (
              <p className={cx(styles.receipt, seen && styles.receiptSeen)}>
                {seen ? (
                  <>
                    <Icon name="eye" size={12} /> Seen {formatTime(data!.counterpartReadAt!)}
                  </>
                ) : (
                  <>
                    <Icon name="check" size={12} /> Sent
                  </>
                )}
              </p>
            ) : null}
          </div>
        ))}
        {counterpartTyping.typing && data ? (
          <div className={styles.typing} aria-label={`${data.counterpart.displayName} is typing`}>
            <Avatar name={data.counterpart.displayName} color={data.counterpart.avatarColor} src={data.counterpart.avatarUrl} size={26} />
            <span className={styles.typingBubble} aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : null}
      </div>

      {closed ? (
        <p className={styles.closed}>This listing is no longer available, so the conversation is closed.</p>
      ) : (
        <div className={styles.composer}>
          {messages.length <= 3 ? (
            <div className={styles.replies}>
              {replies.map((reply) => (
                <button key={reply} type="button" className={styles.reply} onClick={() => send.mutate(reply)} disabled={send.isPending}>
                  {reply}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.inputRow}>
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onKey}
              placeholder="Write a message…"
              rows={1}
              maxLength={2000}
              aria-label="Message"
            />
            <button type="button" className={styles.send} onClick={submit} disabled={!draft.trim() || send.isPending} aria-label="Send message">
              <Icon name="send" size={19} />
            </button>
          </div>
          {send.error ? <p className={styles.sendError}>{send.error instanceof ApiError ? send.error.message : 'Message not sent — try again'}</p> : null}
        </div>
      )}
    </div>
  );
}

export function MarketInbox({ activeId }: { activeId?: string }) {
  return (
    <SignedIn prompt="Sign in to see your messages" promptText="Chats with buyers and sellers live here." loading={<Skeleton height={480} />}>
      {() => (
        <div className={cx(styles.inbox, activeId && styles.hasThread)}>
          <ConversationList activeId={activeId} />
          {activeId ? (
            <Thread key={activeId} id={activeId} />
          ) : (
            <div className={styles.threadEmpty}>
              <Icon name="message" size={36} />
              <p>Select a chat to read it</p>
              <span>Messages about your listings and the items you asked about.</span>
            </div>
          )}
        </div>
      )}
    </SignedIn>
  );
}
