import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../core/auth/middleware';
import { AppError } from '../../core/http/errors';
import { handle } from '../../core/http/handler';
import { authLimiter } from '../../core/http/rate-limit';
import { logger } from '../../core/logger';
import { setSessionCookies } from '../auth/auth.routes';
import { CONNECTION_PROVIDERS } from './connections.model';
import { authProviders, linkDiscord, linkSteam, listConnections, signInWithDiscord, syncSteamGames, unlinkConnection } from './connections.service';
import { consumeOAuthState, issueOAuthState, safeNext } from './oauth-state';
import { discordAuthorizeUrl, discordEnabled, discordProfile, steamAuthorizeUrl, steamReturnTo, verifySteamAssertion } from './providers';

/** Back to a page on our site with the outcome in the query string — never to a provider-supplied URL. */
function backTo(res: Response, path: string, params: Record<string, string>) {
  const [pathname, existing] = path.split('?');
  const query = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  res.redirect(303, `${pathname}?${query}`);
}

function failure(error: unknown): string {
  if (error instanceof AppError) {
    if (error.code === 'OAUTH_STATE') return 'expired';
    if (error.code === 'DISCORD_EMAIL_MISSING') return 'discord_email_missing';
    if (error.code === 'DISCORD_EMAIL_TAKEN') return 'discord_email_taken';
    if (error.status === 409) return 'already_linked';
    if (error.status === 403) return 'suspended';
  } else {
    logger.error({ err: error }, 'Account connection failed');
  }
  return 'failed';
}

const meta = (req: Request) => ({ userAgent: req.get('user-agent') ?? '', ip: req.ip ?? '' });

/** Mounted at /api/v1/auth. These are browser navigations, not API calls. */
export const connectionsAuthRouter = Router();

connectionsAuthRouter.get('/providers', handle({}, () => authProviders()));

connectionsAuthRouter.get('/discord/start', authLimiter, (req, res) => {
  const mode = req.query.mode === 'link' ? 'link' : 'login';
  const next = safeNext(req.query.next, mode === 'link' ? '/settings' : '/');
  const home = mode === 'link' ? '/settings' : '/login';
  if (!discordEnabled()) return backTo(res, home, { auth_error: 'not_configured' });
  if (mode === 'link' && !req.auth) return backTo(res, '/login', { next: '/settings' });
  const state = issueOAuthState(res, { provider: 'discord', mode, next, userId: req.auth?.userId ?? null });
  res.redirect(303, discordAuthorizeUrl(state));
});

connectionsAuthRouter.get('/discord/callback', async (req, res) => {
  let flow;
  try {
    flow = consumeOAuthState(req, res, 'discord', req.query.state);
  } catch (error) {
    return backTo(res, '/login', { auth_error: failure(error) });
  }
  const home = flow.mode === 'link' ? '/settings' : '/login';
  if (typeof req.query.code !== 'string') return backTo(res, home, { auth_error: 'discord_denied' });
  try {
    const profile = await discordProfile(req.query.code);
    if (flow.mode === 'link') {
      // The session that started the flow must be the one finishing it.
      if (!req.auth || req.auth.userId !== flow.userId) throw new AppError(400, 'OAUTH_STATE', 'Session changed');
      await linkDiscord(flow.userId, profile);
      return backTo(res, flow.next, { connected: 'discord' });
    }
    const session = await signInWithDiscord(profile, meta(req));
    setSessionCookies(res, session);
    return backTo(res, flow.next, { signed_in: 'discord' });
  } catch (error) {
    return backTo(res, home, { auth_error: failure(error) });
  }
});

connectionsAuthRouter.get('/steam/start', authLimiter, (req, res) => {
  if (!req.auth) return backTo(res, '/login', { next: '/settings' });
  const state = issueOAuthState(res, { provider: 'steam', mode: 'link', next: safeNext(req.query.next, '/settings'), userId: req.auth.userId });
  res.redirect(303, steamAuthorizeUrl(state));
});

connectionsAuthRouter.get('/steam/callback', async (req, res) => {
  try {
    const flow = consumeOAuthState(req, res, 'steam', req.query.state);
    if (!req.auth || req.auth.userId !== flow.userId) throw new AppError(400, 'OAUTH_STATE', 'Session changed');
    const steamId = await verifySteamAssertion(req.query as Record<string, unknown>, steamReturnTo(flow.state));
    await linkSteam(flow.userId, steamId);
    return backTo(res, flow.next, { connected: 'steam' });
  } catch (error) {
    return backTo(res, '/settings', { auth_error: failure(error) === 'failed' ? 'steam_failed' : failure(error) });
  }
});

/** Mounted at /api/v1/me/connections. */
export const connectionsMeRouter = Router();
connectionsMeRouter.use(requireAuth);

const providerParams = z.object({ provider: z.enum(CONNECTION_PROVIDERS) });

connectionsMeRouter.get('/', handle({}, ({ user }) => listConnections(user().userId)));
connectionsMeRouter.post('/steam/sync', authLimiter, handle({}, ({ user }) => syncSteamGames(user().userId)));
connectionsMeRouter.delete('/:provider', handle({ params: providerParams }, ({ params, user }) => unlinkConnection(user().userId, params.provider)));
