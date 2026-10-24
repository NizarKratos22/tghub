/**
 * Sends a crash to the API's error log. Each distinct message is reported
 * once per page load, so a render loop can't flood the endpoint.
 */
const sent = new Set<string>();

export function reportError(error: unknown, where?: string): void {
  if (typeof window === 'undefined') return;
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
  const key = `${err.name}:${err.message}`;
  if (sent.has(key) || sent.size > 20) return;
  sent.add(key);
  const body = JSON.stringify({
    name: err.name,
    message: err.message.slice(0, 500) || 'Unknown error',
    stack: err.stack?.slice(0, 4000) ?? null,
    where: (where ?? window.location.pathname).slice(0, 300),
  });
  // keepalive lets the report finish even if the page is being unloaded.
  void fetch('/api/v1/errors', { method: 'POST', headers: { 'content-type': 'application/json', 'x-tgh-csrf': '1' }, body, keepalive: true }).catch(() => undefined);
}
