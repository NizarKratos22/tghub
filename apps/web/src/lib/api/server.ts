import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { toQueryString, type QueryParams } from './query';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
/** The API's httpOnly access-token cookie (apps/api/src/core/auth/context.ts). */
const ACCESS_COOKIE = 'tgh_at';

interface ServerFetchOptions {
  query?: QueryParams;
  /** Seconds to cache the response; 0 = always fresh. */
  revalidate?: number;
}

/**
 * Server Components call the API directly (no browser, no proxy hop).
 * A 404 from the API renders the route's not-found page.
 */
export async function serverApi<T>(path: string, options: ServerFetchOptions = {}): Promise<T> {
  const { revalidate = 0, query } = options;
  const response = await fetch(`${API_URL}/api/v1${path}${toQueryString(query)}`, {
    ...(revalidate > 0 ? { next: { revalidate } } : { cache: 'no-store' }),
    headers: { accept: 'application/json' },
  });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`API responded ${response.status} for ${path}`);
  const body = (await response.json()) as { data: T };
  return body.data;
}

/** For optional page furniture (ticker, sidebars): never take the page down with it. */
export async function serverApiOr<T>(path: string, fallback: T, options: ServerFetchOptions = {}): Promise<T> {
  try {
    return await serverApi<T>(path, options);
  } catch {
    return fallback;
  }
}

/**
 * The signed-in viewer's own data, for a page that renders it on the server
 * instead of waiting for the browser: forwards their access token. Null for
 * guests, an expired token or any failure — the page then loads it in the
 * browser as before. Never cached.
 */
export async function viewerApi<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_URL}/api/v1${path}`, {
      cache: 'no-store',
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return ((await response.json()) as { data: T }).data;
  } catch {
    return null;
  }
}
