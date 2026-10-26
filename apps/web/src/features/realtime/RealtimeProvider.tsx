'use client';

import type { RealtimeEvent, RealtimeEventType } from '@tgh/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SESSION_KEY, useSession } from '@/features/auth/session';
import { refreshSession } from '@/lib/api/client';
import { resyncPushSubscription } from './push';

type Handler = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  subscribe: (handler: Handler) => () => void;
  /** True while the live stream is open — screens can stop polling. */
  connected: boolean;
}

const EVENT_TYPES: RealtimeEventType[] = ['notification', 'market.message', 'market.typing', 'market.read'];
const MAX_BACKOFF_MS = 30_000;

const RealtimeContext = createContext<RealtimeContextValue>({ subscribe: () => () => {}, connected: false });

/**
 * One live stream per tab for the signed-in player. The browser's own
 * EventSource retry can't renew an expired access token, so every drop is
 * handled here: refresh the session, then reconnect with backoff.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: me } = useSession();
  const userId = me?.id;
  const queryClient = useQueryClient();
  const handlers = useRef(new Set<Handler>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;

    const open = () => {
      if (stopped) return;
      source = new EventSource('/api/v1/stream');
      source.onopen = () => {
        failures = 0;
        setConnected(true);
      };
      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (message) => {
          let data: unknown;
          try {
            data = JSON.parse((message as MessageEvent<string>).data);
          } catch {
            return;
          }
          const event = { type, data } as RealtimeEvent;
          for (const handler of handlers.current) handler(event);
        });
      }
      source.onerror = () => {
        source?.close();
        source = null;
        setConnected(false);
        reconnect();
      };
    };

    const reopen = async () => {
      timer = undefined;
      // The stream ends when the access token expires; renew it before reopening.
      const renewed = await refreshSession();
      if (!renewed && failures > 2) {
        // Signed out elsewhere: let the session query notice and unmount us.
        void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      }
      open();
    };

    const reconnect = () => {
      if (stopped || timer) return;
      const delay = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** failures) * (0.75 + Math.random() * 0.5);
      failures += 1;
      timer = setTimeout(() => void reopen(), delay);
    };

    const onOnline = () => {
      if (source) return;
      clearTimeout(timer);
      timer = undefined;
      failures = 0;
      open();
    };

    open();
    window.addEventListener('online', onOnline);
    void resyncPushSubscription();
    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
      window.removeEventListener('online', onOnline);
      setConnected(false);
    };
  }, [userId, queryClient]);

  const [value] = useState<Omit<RealtimeContextValue, 'connected'>>(() => ({
    subscribe: (handler) => {
      handlers.current.add(handler);
      return () => handlers.current.delete(handler);
    },
  }));

  return <RealtimeContext.Provider value={{ ...value, connected }}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext).connected;
}

/** Calls `handler` for every live event; the latest handler is always used without resubscribing. */
export function useRealtimeEvent(handler: Handler): void {
  const { subscribe } = useContext(RealtimeContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe]);
}
