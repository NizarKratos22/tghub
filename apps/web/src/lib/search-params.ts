import type { z } from 'zod';
import { toQueryString } from './api/query';

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Keeps the first value of each key. */
export function flatten(params: RawSearchParams): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined && single !== '') flat[key] = single;
  }
  return flat;
}

/**
 * Validates URL params with the same shared schema the API uses; any invalid
 * key is dropped instead of failing the page.
 */
export function parseParams<S extends z.ZodObject>(schema: S, params: RawSearchParams): z.output<S> {
  const flat = flatten(params);
  const parsed = schema.safeParse(flat);
  if (parsed.success) return parsed.data;
  const invalid = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
  const cleaned = Object.fromEntries(Object.entries(flat).filter(([key]) => !invalid.has(key)));
  return schema.parse(cleaned);
}

/** Builds a URL from current params plus changes; any change other than page resets pagination. */
export function hrefWith(
  pathname: string,
  current: Record<string, string | number | boolean | undefined>,
  changes: Record<string, string | number | boolean | undefined | null>,
): string {
  const next: Record<string, string | number | boolean | undefined> = { ...current };
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
  }
  if (!('page' in changes)) delete next.page;
  if (next.page === 1) delete next.page;
  return `${pathname}${toQueryString(next)}`;
}
