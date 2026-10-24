import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider } from '@tgh/shared';
import { env } from '../../config/env';
import { AppError } from '../../core/http/errors';

const TIMEOUT = 15_000;

export type GatewayStatus = 'paid' | 'pending' | 'failed' | 'expired';

export interface CheckoutRequest {
  orderId: string;
  /** Millimes (1 TND = 1000). */
  amount: number;
  description: string;
  returnUrl: string;
  failUrl: string;
}

/**
 * A payment provider. Every gateway answers the same two questions — "start a
 * checkout" and "what's the real status now" — so fulfilment never trusts a
 * redirect or callback on its own.
 */
export interface PaymentGateway {
  name: PaymentProvider;
  createCheckout(request: CheckoutRequest): Promise<{ providerRef: string; payUrl: string }>;
  /** `expected` is the order amount in millimes; a mismatch is never "paid". */
  fetchStatus(providerRef: string, expected: number): Promise<GatewayStatus>;
}

const site = (path: string) => `${env.PUBLIC_WEB_URL}${path}`;

async function json<T>(response: Response, what: string): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!body) throw new AppError(502, 'PAYMENT_PROVIDER', `${what} did not answer — try again in a moment`);
  return body;
}

/* ───────────── Flouci (docs.flouci.com, API v2) ───────────── */

const FLOUCI_API = 'https://developers.flouci.com/api/v2';

const flouciAuth = () => ({ authorization: `Bearer ${env.FLOUCI_PUBLIC_KEY}:${env.FLOUCI_PRIVATE_KEY}` });

export const flouciGateway: PaymentGateway = {
  name: 'flouci',
  async createCheckout(request) {
    const response = await fetch(`${FLOUCI_API}/generate_payment`, {
      method: 'POST',
      headers: { ...flouciAuth(), 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: String(request.amount),
        success_link: request.returnUrl,
        fail_link: request.failUrl,
        webhook: site('/api/v1/payments/webhook/flouci'),
        webhook_version: 2,
        developer_tracking_id: request.orderId,
        session_timeout_secs: 1200,
        accept_card: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = await json<{ result?: { success?: boolean; payment_id?: string; link?: string } }>(response, 'Flouci');
    if (!response.ok || body.result?.success !== true || !body.result.payment_id || !body.result.link) {
      throw new AppError(502, 'PAYMENT_PROVIDER', 'Flouci could not start the payment');
    }
    return { providerRef: body.result.payment_id, payUrl: body.result.link };
  },
  async fetchStatus(providerRef, expected) {
    const response = await fetch(`${FLOUCI_API}/verify_payment/${encodeURIComponent(providerRef)}`, { headers: flouciAuth(), signal: AbortSignal.timeout(TIMEOUT) });
    if (response.status === 404) return 'pending';
    const body = await json<{ success?: boolean; result?: { status?: string; amount?: number } }>(response, 'Flouci');
    const status = body.result?.status;
    // Flouci's rule: paid means success === true AND status "SUCCESS". We also insist on the amount.
    if (body.success === true && status === 'SUCCESS') return body.result?.amount === expected ? 'paid' : 'failed';
    if (status === 'EXPIRED') return 'expired';
    if (status === 'FAILURE' || status === 'SYSTEM_FAILURE') return 'failed';
    return 'pending';
  },
};

/**
 * Flouci signs payment webhooks: `X-Flouci-Signature: t=<unix>,v1=<hex>` where
 * v1 = HMAC-SHA256(private key, "<t>.<raw body>"). Old timestamps are refused
 * so a captured request can't be replayed.
 */
export function verifyFlouciSignature(header: string | undefined, rawBody: Buffer | undefined, secret: string, now = Date.now(), toleranceSec = 300): boolean {
  if (!header || !rawBody) return false;
  const parts = Object.fromEntries(header.split(',').map((part) => part.trim().split('=') as [string, string]));
  const timestamp = Number(parts.t);
  const given = parts.v1;
  if (!Number.isFinite(timestamp) || !given || !/^[0-9a-f]+$/i.test(given)) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${parts.t}.`).update(rawBody).digest('hex');
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given.toLowerCase()));
}

/* ───────────── Konnect (docs.konnect.network, API v2) ───────────── */

const konnectApi = () => (env.KONNECT_SANDBOX ? 'https://api.sandbox.konnect.network/api/v2' : 'https://api.konnect.network/api/v2');

export const konnectGateway: PaymentGateway = {
  name: 'konnect',
  async createCheckout(request) {
    const response = await fetch(`${konnectApi()}/payments/init-payment`, {
      method: 'POST',
      headers: { 'x-api-key': env.KONNECT_API_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify({
        receiverWalletId: env.KONNECT_WALLET_ID,
        token: 'TND',
        amount: request.amount,
        type: 'immediate',
        description: request.description,
        lifespan: 20,
        checkoutForm: false,
        addPaymentFeesToAmount: false,
        orderId: request.orderId,
        // Konnect sends the payer (and status pings) to this URL with ?payment_ref=…
        webhook: site('/api/v1/payments/webhook/konnect'),
        theme: 'light',
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = await json<{ payUrl?: string; paymentRef?: string }>(response, 'Konnect');
    if (!response.ok || !body.payUrl || !body.paymentRef) throw new AppError(502, 'PAYMENT_PROVIDER', 'Konnect could not start the payment');
    return { providerRef: body.paymentRef, payUrl: body.payUrl };
  },
  async fetchStatus(providerRef, expected) {
    const response = await fetch(`${konnectApi()}/payments/${encodeURIComponent(providerRef)}`, {
      headers: { 'x-api-key': env.KONNECT_API_KEY! },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (response.status === 404) return 'pending';
    const body = await json<{ payment?: { status?: string; amount?: number; token?: string; expirationDate?: string } }>(response, 'Konnect');
    const payment = body.payment;
    if (!payment) return 'pending';
    // Konnect: rely on the payment status, "completed" = paid.
    if (payment.status === 'completed') return payment.amount === expected && (payment.token ?? 'TND') === 'TND' ? 'paid' : 'failed';
    if (payment.expirationDate && new Date(payment.expirationDate).getTime() < Date.now()) return 'expired';
    return 'pending';
  },
};

/* ───────────── Local test checkout (development only) ───────────── */

/** Outcome chosen on the fake checkout page, by order id. Lives in memory: it only exists to exercise the flow locally. */
export const devOutcomes = new Map<string, 'paid' | 'failed'>();

export const devGateway: PaymentGateway = {
  name: 'dev',
  async createCheckout(request) {
    return { providerRef: `dev_${request.orderId}`, payUrl: `/market/boost/checkout/${request.orderId}` };
  },
  async fetchStatus(providerRef) {
    return devOutcomes.get(providerRef.replace(/^dev_/, '')) ?? 'pending';
  },
};

/** The gateway this server uses, or null when payments are off. */
export function activeGateway(): PaymentGateway | null {
  const flouciReady = Boolean(env.FLOUCI_PUBLIC_KEY && env.FLOUCI_PRIVATE_KEY);
  const konnectReady = Boolean(env.KONNECT_API_KEY && env.KONNECT_WALLET_ID);
  switch (env.PAYMENT_PROVIDER) {
    case 'flouci':
      return flouciReady ? flouciGateway : null;
    case 'konnect':
      return konnectReady ? konnectGateway : null;
    case 'dev':
      return env.isProduction ? null : devGateway;
    default:
      if (flouciReady) return flouciGateway;
      if (konnectReady) return konnectGateway;
      return env.isProduction ? null : devGateway;
  }
}

export function gatewayFor(name: PaymentProvider): PaymentGateway {
  return name === 'flouci' ? flouciGateway : name === 'konnect' ? konnectGateway : devGateway;
}
