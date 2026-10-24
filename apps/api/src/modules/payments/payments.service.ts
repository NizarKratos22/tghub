import { model, Schema, type Types } from 'mongoose';
import {
  FEATURE_PLAN_IDS,
  FEATURE_PLANS,
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  type AdminPayments,
  type CheckoutStart,
  type FeatureOrder,
  type FeatureOrderInput,
  type FeaturePlan,
  type OrderStatus,
  type PaymentConfig,
  type PaymentProvider,
} from '@tgh/shared';
import { env } from '../../config/env';
import { bus } from '../../core/events/bus';
import { AppError } from '../../core/http/errors';
import { logger } from '../../core/logger';
import { Listing, type ListingDoc } from '../market/market.model';
import { User } from '../users/user.model';
import { toPlayerRef, USER_REF_FIELDS, type PlayerRefSource } from '../users/users.mapper';
import { activeGateway, devOutcomes, gatewayFor, type GatewayStatus } from './gateways';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Status checks against the provider are spaced out (they rate-limit and can ban noisy callers). */
const RECHECK_GAP_MS = 5_000;
/** Unpaid orders older than this are closed. */
const ORDER_TTL_MS = 2 * 60 * 60 * 1000;

export interface OrderDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  plan: FeaturePlan;
  /** Millimes, fixed when the order is created. */
  amount: number;
  provider: PaymentProvider;
  providerRef: string | null;
  status: OrderStatus;
  checkedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

const orderSchema = new Schema<OrderDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    plan: { type: String, enum: FEATURE_PLAN_IDS, required: true },
    amount: { type: Number, required: true },
    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
    providerRef: { type: String, default: null },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    checkedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: 1 });
orderSchema.index({ provider: 1, providerRef: 1 }, { unique: true, partialFilterExpression: { providerRef: { $type: 'string' } } });

export const Order = model<OrderDoc>('Order', orderSchema, 'orders');

export function paymentConfig(): PaymentConfig {
  return {
    provider: activeGateway()?.name ?? null,
    plans: FEATURE_PLAN_IDS.map((id) => ({ id, ...FEATURE_PLANS[id] })),
  };
}

async function toOrderDto(order: OrderDoc, listing?: Pick<ListingDoc, '_id' | 'title' | 'featuredUntil'> | null): Promise<FeatureOrder> {
  const doc = listing ?? (await Listing.findById(order.listingId).select('title featuredUntil').lean<Pick<ListingDoc, '_id' | 'title' | 'featuredUntil'>>());
  const plan = FEATURE_PLANS[order.plan];
  return {
    id: String(order._id),
    listing: { id: String(order.listingId), title: doc?.title ?? 'Listing removed', featuredUntil: doc?.featuredUntil?.toISOString() ?? null },
    plan: order.plan,
    days: plan.days,
    priceTnd: order.amount / 1000,
    provider: order.provider,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

/** Starts a checkout for featuring one of the player's own active listings. */
export async function startFeatureCheckout(userId: string, input: FeatureOrderInput): Promise<CheckoutStart> {
  const gateway = activeGateway();
  if (!gateway) throw new AppError(503, 'PAYMENTS_DISABLED', 'Featuring listings is not available yet');
  const listing = await Listing.findOne({ _id: input.listingId, sellerId: userId }).select('title status').lean<ListingDoc>();
  if (!listing) throw AppError.notFound('Listing');
  if (listing.status !== 'active') throw AppError.unprocessable('Only active listings can be featured');

  const plan = FEATURE_PLANS[input.plan];
  const order = await Order.create({ userId, listingId: listing._id, plan: input.plan, amount: plan.priceTnd * 1000, provider: gateway.name });
  const orderId = String(order._id);
  try {
    const checkout = await gateway.createCheckout({
      orderId,
      amount: order.amount,
      description: `TG Hub — feature "${listing.title.slice(0, 60)}" for ${plan.label}`,
      returnUrl: `${env.PUBLIC_WEB_URL}/api/v1/payments/return/${orderId}`,
      failUrl: `${env.PUBLIC_WEB_URL}/api/v1/payments/return/${orderId}?failed=1`,
    });
    await Order.updateOne({ _id: order._id }, { $set: { providerRef: checkout.providerRef } });
    return { orderId, payUrl: checkout.payUrl };
  } catch (error) {
    await Order.updateOne({ _id: order._id }, { $set: { status: 'failed' } });
    throw error;
  }
}

/** Extends the boost: stacking a second purchase adds days instead of overlapping them. */
async function applyFeature(order: OrderDoc): Promise<void> {
  const listing = await Listing.findById(order.listingId).select('title sellerId featuredUntil').lean<ListingDoc>();
  if (!listing) return;
  const from = Math.max(Date.now(), listing.featuredUntil?.getTime() ?? 0);
  const until = new Date(from + FEATURE_PLANS[order.plan].days * DAY_MS);
  await Listing.updateOne({ _id: listing._id }, { $set: { featuredUntil: until } });
  bus.emit('market.featured', { listingId: String(listing._id), title: listing.title, sellerId: String(listing.sellerId), until: until.toISOString() });
}

/**
 * Asks the provider for the real status and settles the order once. The
 * pending→paid flip is conditional, so a webhook and a redirect arriving
 * together can't apply the boost twice.
 */
export async function reconcileOrder(orderId: string, force = false): Promise<OrderDoc | null> {
  const order = await Order.findById(orderId).lean<OrderDoc>();
  if (!order || order.status !== 'pending' || !order.providerRef) return order;
  if (!force && order.checkedAt && Date.now() - order.checkedAt.getTime() < RECHECK_GAP_MS) return order;
  await Order.updateOne({ _id: order._id }, { $set: { checkedAt: new Date() } });

  let status: GatewayStatus;
  try {
    status = await gatewayFor(order.provider).fetchStatus(order.providerRef, order.amount);
  } catch (error) {
    logger.warn({ err: error, orderId }, 'Payment status check failed');
    return order;
  }
  if (status === 'pending') {
    if (Date.now() - order.createdAt.getTime() > ORDER_TTL_MS) await Order.updateOne({ _id: order._id, status: 'pending' }, { $set: { status: 'expired' } });
    return Order.findById(orderId).lean<OrderDoc>();
  }
  const settled = await Order.findOneAndUpdate(
    { _id: order._id, status: 'pending' },
    { $set: { status, ...(status === 'paid' ? { paidAt: new Date() } : {}) } },
    { returnDocument: 'after' },
  ).lean<OrderDoc>();
  if (settled?.status === 'paid') await applyFeature(settled);
  return settled ?? Order.findById(orderId).lean<OrderDoc>();
}

export async function getOrder(userId: string, orderId: string): Promise<FeatureOrder> {
  const order = await Order.findOne({ _id: orderId, userId }).lean<OrderDoc>();
  if (!order) throw AppError.notFound('Order');
  const current = order.status === 'pending' ? ((await reconcileOrder(orderId)) ?? order) : order;
  return toOrderDto(current);
}

/** Flouci webhook (already signature-checked): find the order, then confirm with Flouci itself. */
export async function settleFlouciPayment(paymentId: string, trackingId: string | null): Promise<void> {
  const order = await Order.findOne(trackingId && /^[a-f\d]{24}$/i.test(trackingId) ? { _id: trackingId, providerRef: paymentId } : { provider: 'flouci', providerRef: paymentId })
    .select('_id')
    .lean();
  if (order) await reconcileOrder(String(order._id), true);
}

/** Konnect's callback is unsigned: it only tells us which payment to re-check. */
export async function settleKonnectPayment(paymentRef: string): Promise<string | null> {
  const order = await Order.findOne({ provider: 'konnect', providerRef: paymentRef }).select('_id').lean();
  if (!order) return null;
  await reconcileOrder(String(order._id), true);
  return String(order._id);
}

/** The local test checkout's "Pay" / "Cancel" buttons. */
export async function completeDevPayment(userId: string, orderId: string, outcome: 'paid' | 'failed'): Promise<FeatureOrder> {
  if (env.isProduction) throw AppError.notFound('Order');
  const order = await Order.findOne({ _id: orderId, userId, provider: 'dev' }).lean<OrderDoc>();
  if (!order) throw AppError.notFound('Order');
  devOutcomes.set(orderId, outcome);
  await reconcileOrder(orderId, true);
  return getOrder(userId, orderId);
}

/** Catches payments whose webhook never arrived, and closes abandoned checkouts. */
export async function reconcilePendingOrders(): Promise<{ checked: number }> {
  const pending = await Order.find({ status: 'pending', providerRef: { $ne: null } }).sort({ createdAt: 1 }).limit(50).select('_id').lean();
  for (const order of pending) await reconcileOrder(String(order._id), true);
  await Order.updateMany({ status: 'pending', createdAt: { $lt: new Date(Date.now() - ORDER_TTL_MS) } }, { $set: { status: 'expired' } });
  return { checked: pending.length };
}

export async function adminPayments(): Promise<AdminPayments> {
  const [orders, revenue] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).limit(50).lean<OrderDoc[]>(),
    Order.aggregate<{ _id: null; allTime: number; last30Days: number }>([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: null,
          allTime: { $sum: '$amount' },
          last30Days: { $sum: { $cond: [{ $gte: ['$paidAt', new Date(Date.now() - 30 * DAY_MS)] }, '$amount', 0] } },
        },
      },
    ]),
  ]);
  const [users, listings] = await Promise.all([
    User.find({ _id: { $in: orders.map((o) => o.userId) } }).select(USER_REF_FIELDS).lean<PlayerRefSource[]>(),
    Listing.find({ _id: { $in: orders.map((o) => o.listingId) } }).select('title featuredUntil').lean<Array<Pick<ListingDoc, '_id' | 'title' | 'featuredUntil'>>>(),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), toPlayerRef(u)]));
  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  return {
    provider: activeGateway()?.name ?? null,
    revenue: { allTime: (revenue[0]?.allTime ?? 0) / 1000, last30Days: (revenue[0]?.last30Days ?? 0) / 1000 },
    orders: await Promise.all(
      orders.map(async (order) => ({
        ...(await toOrderDto(order, listingById.get(String(order.listingId)) ?? null)),
        buyer: userById.get(String(order.userId)) ?? { id: '', username: '', displayName: 'Former member', avatarColor: '#62686d', avatarUrl: null },
        providerRef: order.providerRef,
      })),
    ),
  };
}
