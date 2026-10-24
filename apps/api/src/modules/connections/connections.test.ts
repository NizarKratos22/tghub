import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { consumeOAuthState, issueOAuthState, safeNext } from './oauth-state';
import { STEAM_OPENID, verifySteamAssertion } from './providers';

const STEAM_ID = '76561198000000001';
const RETURN_TO = 'http://localhost:3000/api/v1/auth/steam/callback?state=abc';

function assertion(overrides: Record<string, string> = {}) {
  return {
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': STEAM_OPENID,
    'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    'openid.return_to': RETURN_TO,
    'openid.response_nonce': '2026-10-24T12:00:00Zabc',
    'openid.assoc_handle': '1234567890',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'c2lnbmF0dXJl',
    ...overrides,
  };
}

/** Stands in for Steam's check_authentication endpoint. */
const steamSays = (valid: boolean, seen?: { body?: string }) =>
  (async (_url: string, init?: RequestInit) => {
    if (seen) seen.body = String(init?.body);
    return new Response(`ns:http://specs.openid.net/auth/2.0\nis_valid:${valid}\n`);
  }) as unknown as typeof fetch;

describe('Steam OpenID', () => {
  it('returns the SteamID once Steam confirms the assertion', async () => {
    const seen: { body?: string } = {};
    assert.equal(await verifySteamAssertion(assertion(), RETURN_TO, steamSays(true, seen)), STEAM_ID);
    assert.match(seen.body!, /openid\.mode=check_authentication/);
  });

  it('rejects anything Steam does not vouch for', async () => {
    await assert.rejects(verifySteamAssertion(assertion(), RETURN_TO, steamSays(false)));
  });

  it('rejects assertions aimed elsewhere or from another provider', async () => {
    const valid = steamSays(true);
    await assert.rejects(verifySteamAssertion(assertion({ 'openid.op_endpoint': 'https://evil.example/openid/login' }), RETURN_TO, valid));
    await assert.rejects(verifySteamAssertion(assertion({ 'openid.return_to': 'https://evil.example/callback' }), RETURN_TO, valid));
    await assert.rejects(verifySteamAssertion(assertion({ 'openid.claimed_id': 'https://evil.example/openid/id/1' }), RETURN_TO, valid));
    await assert.rejects(verifySteamAssertion(assertion({ 'openid.mode': 'cancel' }), RETURN_TO, valid));
  });
});

describe('OAuth state', () => {
  it('only allows same-site return paths', () => {
    assert.equal(safeNext('/settings'), '/settings');
    assert.equal(safeNext('//evil.example'), '/');
    assert.equal(safeNext('/\\evil.example'), '/');
    assert.equal(safeNext('https://evil.example'), '/');
    assert.equal(safeNext(undefined, '/login'), '/login');
  });

  function cookieJar() {
    const cookies: Record<string, string> = {};
    const res = {
      cookie: (name: string, value: string) => (cookies[name] = value),
      clearCookie: (name: string) => delete cookies[name],
    } as unknown as Response;
    const req = () => ({ cookies: { ...cookies } }) as unknown as Request;
    return { res, req };
  }

  it('round-trips once, for the right provider and state', () => {
    const jar = cookieJar();
    const state = issueOAuthState(jar.res, { provider: 'discord', mode: 'login', next: '/', userId: null });
    const request = jar.req();
    assert.equal(consumeOAuthState(request, jar.res, 'discord', state).next, '/');
    // Consumed: the same callback can't be replayed.
    assert.throws(() => consumeOAuthState(jar.req(), jar.res, 'discord', state));
  });

  it('rejects a forged state or the wrong provider', () => {
    const jar = cookieJar();
    const state = issueOAuthState(jar.res, { provider: 'steam', mode: 'link', next: '/settings', userId: 'u1' });
    assert.throws(() => consumeOAuthState(jar.req(), jar.res, 'steam', `${state}x`));
    const again = cookieJar();
    const second = issueOAuthState(again.res, { provider: 'steam', mode: 'link', next: '/settings', userId: 'u1' });
    assert.throws(() => consumeOAuthState(again.req(), again.res, 'discord', second));
  });
});
