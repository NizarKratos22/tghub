import { env } from '../../config/env';
import { AppError } from '../../core/http/errors';

const TIMEOUT = 10_000;

/* ───────────── Discord (OAuth2) ───────────── */

const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN = 'https://discord.com/api/oauth2/token';
const DISCORD_ME = 'https://discord.com/api/v10/users/@me';

export interface DiscordProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
}

export const discordEnabled = () => Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
export const discordRedirectUri = () => `${env.PUBLIC_WEB_URL}/api/v1/auth/discord/callback`;

export function discordAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: discordRedirectUri(),
    scope: 'identify email',
    state,
    // Players who already approved TG Hub skip the consent screen.
    prompt: 'none',
  });
  return `${DISCORD_AUTHORIZE}?${params}`;
}

export function discordAvatarUrl(id: string, avatar: string | null): string | null {
  return avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=256` : null;
}

/** Exchanges the callback code for a token and reads the player's Discord account. */
export async function discordProfile(code: string, fetchImpl: typeof fetch = fetch): Promise<DiscordProfile> {
  const tokenResponse = await fetchImpl(DISCORD_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      client_secret: env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: discordRedirectUri(),
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!tokenResponse.ok) throw new AppError(502, 'DISCORD_FAILED', 'Discord did not accept the sign-in');
  const token = (await tokenResponse.json()) as { access_token?: string; token_type?: string };
  if (!token.access_token) throw new AppError(502, 'DISCORD_FAILED', 'Discord did not accept the sign-in');

  const meResponse = await fetchImpl(DISCORD_ME, {
    headers: { authorization: `${token.token_type ?? 'Bearer'} ${token.access_token}` },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!meResponse.ok) throw new AppError(502, 'DISCORD_FAILED', 'Could not read your Discord account');
  const me = (await meResponse.json()) as { id: string; username: string; global_name?: string | null; avatar?: string | null; email?: string | null; verified?: boolean };
  return {
    id: me.id,
    username: me.username,
    displayName: me.global_name || me.username,
    avatarUrl: discordAvatarUrl(me.id, me.avatar ?? null),
    email: me.email?.toLowerCase() ?? null,
    emailVerified: me.verified === true,
  };
}

/* ───────────── Steam (OpenID 2.0) ───────────── */

export const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const STEAM_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export const steamReturnTo = (state: string) => `${env.PUBLIC_WEB_URL}/api/v1/auth/steam/callback?state=${encodeURIComponent(state)}`;

export function steamAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': steamReturnTo(state),
    'openid.realm': env.PUBLIC_WEB_URL,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${STEAM_OPENID}?${params}`;
}

/**
 * Checks Steam's OpenID assertion: the fields must point at Steam and back at
 * us, and Steam itself must confirm the signature (check_authentication).
 * Returns the 64-bit SteamID.
 */
export async function verifySteamAssertion(query: Record<string, unknown>, expectedReturnTo: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const field = (name: string) => (typeof query[`openid.${name}`] === 'string' ? (query[`openid.${name}`] as string) : '');
  const fail = () => new AppError(400, 'STEAM_FAILED', 'Steam sign-in could not be verified');
  if (field('mode') !== 'id_res' || field('op_endpoint') !== STEAM_OPENID) throw fail();
  if (field('return_to') !== expectedReturnTo) throw fail();
  const claimed = STEAM_ID.exec(field('claimed_id'));
  if (!claimed || field('identity') !== field('claimed_id')) throw fail();

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (key.startsWith('openid.') && typeof value === 'string') body.set(key, value);
  body.set('openid.mode', 'check_authentication');
  const response = await fetchImpl(STEAM_OPENID, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const text = response.ok ? await response.text() : '';
  if (!/^is_valid:true$/m.test(text)) throw fail();
  return claimed[1]!;
}

export const steamProfileUrl = (steamId: string) => `https://steamcommunity.com/profiles/${steamId}`;

export async function steamSummary(steamId: string): Promise<{ personaName: string; avatarUrl: string | null } | null> {
  if (!env.STEAM_API_KEY) return null;
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${env.STEAM_API_KEY}&steamids=${steamId}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!response.ok) return null;
  const body = (await response.json()) as { response?: { players?: Array<{ personaname?: string; avatarfull?: string }> } };
  const player = body.response?.players?.[0];
  return player ? { personaName: player.personaname ?? 'Steam player', avatarUrl: player.avatarfull ?? null } : null;
}

/** Owned games with playtime. Private Steam profiles return nothing. */
export async function steamOwnedGames(steamId: string): Promise<Array<{ appId: number; minutes: number }>> {
  if (!env.STEAM_API_KEY) return [];
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${env.STEAM_API_KEY}&steamid=${steamId}&include_played_free_games=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!response.ok) throw new AppError(502, 'STEAM_FAILED', 'Steam did not answer — try again in a minute');
  const body = (await response.json()) as { response?: { games?: Array<{ appid: number; playtime_forever?: number }> } };
  return (body.response?.games ?? []).map((game) => ({ appId: game.appid, minutes: game.playtime_forever ?? 0 }));
}
