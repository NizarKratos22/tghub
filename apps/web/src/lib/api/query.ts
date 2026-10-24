export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

/** Builds "?a=1&b=2", skipping empty values. */
export function toQueryString(query?: QueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
