import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { UpstreamError } from '../../core/http/upstream';
import { IgdbClient } from './igdb.client';

const realFetch = globalThis.fetch;
type Call = { url: string; auth: string | null; at: number };

/** Stands in for Twitch's token endpoint and IGDB; `reject` lists IGDB tokens that answer 401. */
function stubNetwork(reject: Set<string> = new Set()) {
  const calls: Call[] = [];
  let issued = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get('authorization');
    calls.push({ url, auth, at: Date.now() });
    if (url.startsWith('https://id.twitch.tv/oauth2/token')) {
      issued += 1;
      return Response.json({ access_token: `minted-token-${issued}`, expires_in: 5_000_000, token_type: 'bearer' });
    }
    const token = auth?.replace('Bearer ', '') ?? '';
    if (reject.has(token)) return new Response('Unauthorized', { status: 401 });
    return Response.json([{ id: 1, name: 'Game' }]);
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('IgdbClient', () => {
  test('fetches an app token with the client secret and sends it with the client id', async () => {
    const calls = stubNetwork();
    const client = new IgdbClient({ clientId: 'client-id-123', clientSecret: 'secret-1234567890', token: null });
    assert.deepEqual(await client.query('games', 'fields name;'), [{ id: 1, name: 'Game' }]);
    assert.match(calls[0]!.url, /grant_type=client_credentials/);
    assert.equal(calls[1]!.url, 'https://api.igdb.com/v4/games');
    assert.equal(calls[1]!.auth, 'Bearer minted-token-1');
  });

  test('renews a rejected token once and retries', async () => {
    const calls = stubNetwork(new Set(['pasted-token']));
    const client = new IgdbClient({ clientId: 'client-id-123', clientSecret: 'secret-1234567890', token: 'pasted-token' });
    await client.query('games', 'fields name;');
    assert.deepEqual(
      calls.map((call) => (call.url.includes('twitch') ? 'token' : call.auth)),
      ['Bearer pasted-token', 'token', 'Bearer minted-token-1'],
    );
  });

  test('explains an expired token when there is no secret to renew it', async () => {
    stubNetwork(new Set(['old-token']));
    const client = new IgdbClient({ clientId: 'client-id-123', clientSecret: null, token: 'old-token' });
    await assert.rejects(client.query('games', 'fields name;'), (error: unknown) => error instanceof UpstreamError && /IGDB_CLIENT_SECRET/.test(error.message));
  });

  test('spaces requests out to stay under 4 a second', async () => {
    const calls = stubNetwork();
    const client = new IgdbClient({ clientId: 'client-id-123', clientSecret: null, token: 'good-token' });
    await Promise.all([client.query('games', 'a'), client.query('games', 'b'), client.query('games', 'c')]);
    const gaps = calls.slice(1).map((call, i) => call.at - calls[i]!.at);
    assert.ok(gaps.every((gap) => gap >= 250), `gaps were ${gaps.join(', ')} ms`);
  });
});
