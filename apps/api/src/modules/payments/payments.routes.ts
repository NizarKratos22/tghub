import { Router } from 'express';
import { featureOrderSchema, idParamsSchema } from '@tgh/shared';
import { z } from 'zod';
import { env } from '../../config/env';
import { requireAuth, requireVerifiedEmail } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { listingWriteLimiter } from '../../core/http/rate-limit';
import { logger } from '../../core/logger';
import { verifyFlouciSignature } from './gateways';
import { completeDevPayment, getOrder, paymentConfig, reconcileOrder, settleFlouciPayment, settleKonnectPayment, startFeatureCheckout } from './payments.service';

/** Mounted at /api/v1/payments. */
export const paymentsRouter = Router();

paymentsRouter.get('/config', handle({}, () => paymentConfig()));

paymentsRouter.post(
  '/featured',
  requireAuth,
  requireVerifiedEmail,
  listingWriteLimiter,
  handle({ body: featureOrderSchema, status: 201 }, ({ body, user }) => startFeatureCheckout(user().userId, body)),
);

paymentsRouter.get('/orders/:id', requireAuth, handle({ params: idParamsSchema }, ({ params, user }) => getOrder(user().userId, params.id)));

/** The provider sends the payer back here; settle what we can, then show the order page. */
paymentsRouter.get('/return/:id', async (req, res) => {
  const parsed = idParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.redirect(303, '/market/selling');
  await reconcileOrder(parsed.data.id, true).catch((error: unknown) => logger.warn({ err: error }, 'Return reconcile failed'));
  res.redirect(303, `/market/boost/${parsed.data.id}`);
});

/** Flouci webhook v2: signed JSON. Only the signature gets us to look; Flouci's own API decides "paid". */
paymentsRouter.post('/webhook/flouci', async (req, res) => {
  if (!env.FLOUCI_PRIVATE_KEY || !verifyFlouciSignature(req.get('x-flouci-signature'), req.rawBody, env.FLOUCI_PRIVATE_KEY)) {
    res.status(401).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature' } });
    return;
  }
  const event = req.body as { payment_id?: string; developer_tracking_id?: string | null };
  if (typeof event.payment_id === 'string') await settleFlouciPayment(event.payment_id, event.developer_tracking_id ?? null);
  res.status(204).end();
});

/**
 * Konnect calls this with ?payment_ref=… — both as a status ping and to bring
 * the payer back. It is unsigned, so it only triggers a re-check.
 */
paymentsRouter.get('/webhook/konnect', async (req, res) => {
  const ref = z.string().regex(/^[\w-]{6,64}$/).safeParse(req.query.payment_ref);
  const orderId = ref.success ? await settleKonnectPayment(ref.data).catch(() => null) : null;
  res.redirect(303, orderId ? `/market/boost/${orderId}` : '/market/selling');
});

/** Local test checkout only (the route answers 404 in production). */
paymentsRouter.post(
  '/dev/:id/:outcome',
  requireAuth,
  handle({ params: z.object({ id: idParamsSchema.shape.id, outcome: z.enum(['paid', 'failed']) }) }, ({ params, user }) => completeDevPayment(user().userId, params.id, params.outcome)),
);
