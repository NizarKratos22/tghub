import { z } from 'zod';
import { env } from '../../config/env';
import { fetchJson, UpstreamError } from '../../core/http/upstream';

/**
 * IGDB v4 (https://api-docs.igdb.com). Queries are Apicalypse text posted to
 * one endpoint per entity. Limits: 4 requests a second and 8 open at once —
 * requests here go one at a time, at least 260 ms apart.
 */
const SERVICE = 'IGDB';
const API = 'https://api.igdb.com/v4';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const MIN_GAP_MS = 260;
/** Renew an hour early so a long sync never runs into expiry halfway. */
const RENEW_EARLY_MS = 60 * 60 * 1000;

export interface IgdbCredentials {
  clientId: string;
  /** With the secret, app tokens are fetched and renewed here (client-credentials flow). */
  clientSecret: string | null;
  /** A ready-made app access token, used until it stops working. */
  token: string | null;
}

export class IgdbNotConfiguredError extends Error {
  constructor() {
    super('IGDB is not connected — set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET (or IGDB_TOKEN) on the API server');
    this.name = 'IgdbNotConfiguredError';
  }
}

const tokenSchema = z.object({ access_token: z.string().min(10), expires_in: z.number().positive() });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class IgdbClient {
  private token: string | null;
  private tokenExpiresAt: number;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(private readonly credentials: IgdbCredentials) {
    this.token = credentials.token;
    // A pasted token's lifetime is unknown: use it until IGDB rejects it.
    this.tokenExpiresAt = credentials.token ? Number.POSITIVE_INFINITY : 0;
  }

  /** Runs one Apicalypse query, e.g. `query('games', 'fields name; where id = 1942;')`. */
  query(endpoint: string, body: string): Promise<unknown[]> {
    const run = () => this.send(endpoint, body);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async accessToken(renew = false): Promise<string> {
    if (!renew && this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (!this.credentials.clientSecret) {
      throw new UpstreamError(SERVICE, 401, 'IGDB rejected the access token — it has probably expired. Set IGDB_CLIENT_SECRET so the server renews it, or paste a new IGDB_TOKEN.');
    }
    const url = new URL(TOKEN_URL);
    url.search = new URLSearchParams({ client_id: this.credentials.clientId, client_secret: this.credentials.clientSecret, grant_type: 'client_credentials' }).toString();
    const parsed = tokenSchema.safeParse(await fetchJson('Twitch', url, { method: 'POST' }));
    if (!parsed.success) throw new UpstreamError('Twitch', null, 'Twitch returned an unexpected token response');
    this.token = parsed.data.access_token;
    this.tokenExpiresAt = Date.now() + parsed.data.expires_in * 1000 - RENEW_EARLY_MS;
    return this.token;
  }

  private async send(endpoint: string, body: string, attempt = 0): Promise<unknown[]> {
    const wait = this.lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    const token = await this.accessToken();
    this.lastRequestAt = Date.now();
    try {
      const data = await fetchJson(
        SERVICE,
        `${API}/${endpoint}`,
        { method: 'POST', headers: { 'Client-ID': this.credentials.clientId, Authorization: `Bearer ${token}`, Accept: 'application/json' }, body },
        15_000,
      );
      if (!Array.isArray(data)) throw new UpstreamError(SERVICE, null, 'IGDB returned an unexpected response');
      return data;
    } catch (error) {
      if (!(error instanceof UpstreamError) || attempt > 0) throw error;
      if (error.status === 401 && this.credentials.clientSecret) {
        await this.accessToken(true);
        return this.send(endpoint, body, attempt + 1);
      }
      if (error.status === 401) await this.accessToken(true); // throws the "expired token" explanation
      if (error.status === 429) {
        await sleep(1_000);
        return this.send(endpoint, body, attempt + 1);
      }
      throw error;
    }
  }
}

let shared: IgdbClient | null = null;

export const igdbConfigured = (): boolean => Boolean(env.igdb);

/** The API's one IGDB client, so every caller shares the same rate limit. */
export function igdb(): IgdbClient {
  if (!env.igdb) throw new IgdbNotConfiguredError();
  shared ??= new IgdbClient(env.igdb);
  return shared;
}
