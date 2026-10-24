import { notFound } from 'next/navigation';
import { toQueryString, type QueryParams } from './query';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

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
