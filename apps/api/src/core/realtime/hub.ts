import type { Response } from 'express';
import type { RealtimeEvent } from '@tgh/shared';
import { logger } from '../logger';

/** Comment lines keep proxies from timing out idle streams. */
const HEARTBEAT_MS = 25_000;
/** A player with many tabs open still gets a bounded number of streams. */
const MAX_STREAMS_PER_USER = 8;

/**
 * Who is connected to this API process, and a way to reach them.
 *
 * In-process on purpose: one API instance holds every stream today. Running
 * several instances means fanning `publish` out through Redis pub/sub — the
 * callers don't change, only this file does.
 */
class RealtimeHub {
  private readonly streams = new Map<string, Set<Response>>();
  private heartbeat: NodeJS.Timeout | null = null;

  /** Registers an open SSE response; returns the cleanup to call when it closes. */
  connect(userId: string, res: Response): () => void {
    const set = this.streams.get(userId) ?? new Set<Response>();
    if (set.size >= MAX_STREAMS_PER_USER) {
      // Oldest tab loses its stream; its EventSource reconnects if it's still open.
      const oldest = set.values().next().value;
      if (oldest) {
        oldest.end();
        set.delete(oldest);
      }
    }
    set.add(res);
    this.streams.set(userId, set);
    this.startHeartbeat();
    return () => {
      set.delete(res);
      if (set.size === 0) this.streams.delete(userId);
    };
  }

  isOnline(userId: string): boolean {
    return (this.streams.get(userId)?.size ?? 0) > 0;
  }

  publish(userId: string, event: RealtimeEvent): void {
    const set = this.streams.get(userId);
    if (!set) return;
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const res of set) res.write(frame);
  }

  get connections(): number {
    let total = 0;
    for (const set of this.streams.values()) total += set.size;
    return total;
  }

  /** On shutdown: open streams would otherwise keep the HTTP server from closing. */
  closeAll(): void {
    for (const set of this.streams.values()) for (const res of set) res.end();
    this.streams.clear();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private startHeartbeat() {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      if (this.streams.size === 0) {
        clearInterval(this.heartbeat!);
        this.heartbeat = null;
        return;
      }
      for (const set of this.streams.values()) for (const res of set) res.write(': ping\n\n');
    }, HEARTBEAT_MS);
    this.heartbeat.unref();
  }
}

export const realtime = new RealtimeHub();

/** Runs a publish without letting a broken socket fail the request that triggered it. */
export function publishSafely(userId: string, event: RealtimeEvent): void {
  try {
    realtime.publish(userId, event);
  } catch (error) {
    logger.warn({ err: error, userId, type: event.type }, 'Realtime publish failed');
  }
}
