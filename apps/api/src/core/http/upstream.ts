/** A failure talking to a third-party API, with a message safe to show admins (no URLs or keys). */
export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export async function fetchJson(service: string, url: string | URL, init: RequestInit = {}, timeoutMs = 10_000): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new UpstreamError(service, null, timedOut ? `${service} timed out` : `${service} is unreachable`);
  }
  if (response.status === 429) throw new UpstreamError(service, 429, `${service} rate limit reached — try again later`);
  if (response.status === 401 || response.status === 403) {
    throw new UpstreamError(service, response.status, `${service} rejected the API credentials`);
  }
  if (response.status === 404) throw new UpstreamError(service, 404, `${service} has no such item`);
  if (!response.ok) throw new UpstreamError(service, response.status, `${service} responded ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new UpstreamError(service, response.status, `${service} returned invalid JSON`);
  }
}

/** Epoch numbers in seconds or milliseconds (providers don't document which) → Date. */
export function fromEpoch(value: number | null | undefined): Date | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value > 1e12 ? value : value * 1000);
}
