import type { QueryFilter, Types } from 'mongoose';
import type { ConversationSummary, CursorPage, MarketMessage as MarketMessageDto } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { iso, toObjectId } from '../../core/http/utils';
import { logger } from '../../core/logger';
import { publishSafely, realtime } from '../../core/realtime/hub';
import { mediaByIds } from '../media/media.service';
import { sendPush } from '../push/push.service';
import { User } from '../users/user.model';
import { USER_REF_FIELDS } from '../users/users.mapper';
import { coverOf, GONE_USER, toMessage, toSellerRef, type SellerSource } from './market.mapper';
import { Conversation, Listing, MarketMessage, type ConversationDoc, type ListingDoc, type MarketMessageDoc } from './market.model';

const PREVIEW_LENGTH = 140;
const CLOSED_STATUSES = new Set(['removed', 'deleted']);

function roleOf(conversation: Pick<ConversationDoc, 'buyerId' | 'sellerId'>, userId: string): 'buyer' | 'seller' | null {
  if (String(conversation.buyerId) === userId) return 'buyer';
  if (String(conversation.sellerId) === userId) return 'seller';
  return null;
}

async function participantConversation(userId: string, conversationId: string): Promise<ConversationDoc & { role: 'buyer' | 'seller' }> {
  const conversation = await Conversation.findById(conversationId).lean<ConversationDoc>();
  const role = conversation ? roleOf(conversation, userId) : null;
  // Someone else's thread looks exactly like a missing one.
  if (!conversation || !role) throw AppError.notFound('Conversation');
  return { ...conversation, role };
}

/** Writes the message and moves the counters: the sender has read everything, the other side has one more unread. */
async function appendMessage(conversation: Pick<ConversationDoc, '_id' | 'buyerId'>, senderId: string, body: string): Promise<MarketMessageDoc> {
  const message = await MarketMessage.create({ conversationId: conversation._id, senderId, body });
  const fromBuyer = String(conversation.buyerId) === senderId;
  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessage: { body: body.slice(0, PREVIEW_LENGTH), senderId: toObjectId(senderId), at: message.createdAt },
        lastMessageAt: message.createdAt,
        [fromBuyer ? 'buyerUnread' : 'sellerUnread']: 0,
        [fromBuyer ? 'buyerReadAt' : 'sellerReadAt']: message.createdAt,
      },
      $inc: { [fromBuyer ? 'sellerUnread' : 'buyerUnread']: 1 },
    },
  );
  return message.toObject();
}

/** One phone notification per thread per minute; the device replaces it with the newest anyway. */
const PUSH_GAP_MS = 60_000;
const lastPushed = new Map<string, number>();

/**
 * Live delivery: both sides' open tabs get the message at once. If the
 * recipient isn't on the site, their phone gets it instead — except for the
 * first message, which already arrives as a notification.
 */
async function announceMessage(
  conversation: Pick<ConversationDoc, '_id' | 'buyerId' | 'sellerId' | 'listingId'>,
  message: MarketMessageDoc,
  senderId: string,
  first: boolean,
): Promise<void> {
  const recipientId = String(String(conversation.buyerId) === senderId ? conversation.sellerId : conversation.buyerId);
  const [sender, listing] = await Promise.all([
    User.findById(senderId).select(USER_REF_FIELDS).lean<SellerSource>(),
    Listing.findById(conversation.listingId).select('title').lean<Pick<ListingDoc, 'title'>>(),
  ]);
  const from = sender ? toSellerRef(sender) : GONE_USER;
  const listingTitle = listing?.title ?? 'Listing';
  const conversationId = String(conversation._id);
  for (const userId of [recipientId, senderId]) {
    publishSafely(userId, { type: 'market.message', data: { conversationId, message: toMessage(message, userId), from, listingTitle } });
  }

  if (first || realtime.isOnline(recipientId)) return;
  const key = `${conversationId}:${recipientId}`;
  const now = Date.now();
  if (now - (lastPushed.get(key) ?? 0) < PUSH_GAP_MS) return;
  if (lastPushed.size > 5_000) lastPushed.clear();
  lastPushed.set(key, now);
  await sendPush(
    [recipientId],
    { title: from.displayName, body: `${listingTitle}: ${message.body}`, url: `/market/inbox/${conversationId}`, tag: `chat-${conversationId}` },
    { urgency: 'high', ttl: 3_600 },
  );
}

/** The request answers right away; live delivery and push happen after. */
function announceInBackground(...args: Parameters<typeof announceMessage>) {
  announceMessage(...args).catch((error: unknown) => logger.warn({ err: error }, 'Message announcement failed'));
}

/** A buyer's message on a listing opens the thread, or continues the one they already have. */
export async function messageSeller(buyerId: string, listingId: string, body: string): Promise<{ conversationId: string; message: MarketMessageDto }> {
  const listing = await Listing.findById(listingId).select('sellerId status title').lean<Pick<ListingDoc, '_id' | 'sellerId' | 'status' | 'title'>>();
  if (!listing || CLOSED_STATUSES.has(listing.status)) throw AppError.notFound('Listing');
  if (String(listing.sellerId) === buyerId) throw AppError.unprocessable("This is your own listing — buyers' messages show up in your inbox");

  let conversation = await Conversation.findOne({ listingId: listing._id, buyerId }).lean<ConversationDoc>();
  let started = false;
  if (!conversation) {
    if (listing.status === 'sold') throw AppError.unprocessable('This item has already been sold');
    try {
      conversation = (
        await Conversation.create({ listingId: listing._id, sellerId: listing.sellerId, buyerId, lastMessageAt: new Date() })
      ).toObject();
      started = true;
    } catch (error) {
      // Two tabs racing to send the first message: use the thread that won.
      if (!isDuplicateKeyError(error)) throw error;
      conversation = await Conversation.findOne({ listingId: listing._id, buyerId }).lean<ConversationDoc>();
      if (!conversation) throw error;
    }
  }

  const message = await appendMessage(conversation, buyerId, body);
  announceInBackground(conversation, message, buyerId, started);
  if (started) {
    bus.emit('market.conversation_started', {
      conversationId: String(conversation._id),
      listingId: String(listing._id),
      listingTitle: listing.title,
      sellerId: String(listing.sellerId),
      buyerId,
    });
  }
  return { conversationId: String(conversation._id), message: toMessage(message, buyerId) };
}

export async function sendMessage(userId: string, conversationId: string, body: string): Promise<MarketMessageDto> {
  const conversation = await participantConversation(userId, conversationId);
  const listing = await Listing.findById(conversation.listingId).select('status').lean<Pick<ListingDoc, 'status'>>();
  if (!listing || CLOSED_STATUSES.has(listing.status)) throw AppError.unprocessable('This listing is no longer available, so the conversation is closed');
  const message = await appendMessage(conversation, userId, body);
  announceInBackground(conversation, message, userId, false);
  return toMessage(message, userId);
}

/** "Typing…" for the other side. Nothing is stored. */
export async function signalTyping(userId: string, conversationId: string): Promise<void> {
  const conversation = await participantConversation(userId, conversationId);
  const counterpartId = String(conversation.role === 'buyer' ? conversation.sellerId : conversation.buyerId);
  publishSafely(counterpartId, { type: 'market.typing', data: { conversationId } });
}

async function summaries(userId: string, conversations: ConversationDoc[]): Promise<ConversationSummary[]> {
  if (conversations.length === 0) return [];
  const listingIds = conversations.map((c) => c.listingId);
  const counterpartIds = conversations.map((c) => (String(c.buyerId) === userId ? c.sellerId : c.buyerId));

  const [listings, users] = await Promise.all([
    Listing.find({ _id: { $in: listingIds } }).select('title price status photoIds').lean<ListingDoc[]>(),
    User.find({ _id: { $in: counterpartIds } }).select(USER_REF_FIELDS).lean<SellerSource[]>(),
  ]);
  const media = await mediaByIds(listings.flatMap((l) => l.photoIds.slice(0, 1)));
  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  const userById = new Map(users.map((u) => [String(u._id), toSellerRef(u)]));

  return conversations.map((conversation) => {
    const role = roleOf(conversation, userId)!;
    const listing = listingById.get(String(conversation.listingId));
    const counterpartId = String(role === 'buyer' ? conversation.sellerId : conversation.buyerId);
    return {
      id: String(conversation._id),
      role,
      listing: {
        id: String(conversation.listingId),
        title: listing?.title ?? 'Listing removed',
        price: listing?.price ?? 0,
        status: listing?.status ?? 'deleted',
        photo: listing && !CLOSED_STATUSES.has(listing.status) ? coverOf(listing, media) : null,
      },
      counterpart: userById.get(counterpartId) ?? GONE_USER,
      lastMessage: conversation.lastMessage
        ? { body: conversation.lastMessage.body, mine: String(conversation.lastMessage.senderId) === userId, at: conversation.lastMessage.at.toISOString() }
        : null,
      unread: role === 'buyer' ? conversation.buyerUnread : conversation.sellerUnread,
      counterpartReadAt: iso(role === 'buyer' ? conversation.sellerReadAt : conversation.buyerReadAt),
      updatedAt: conversation.lastMessageAt.toISOString(),
    };
  });
}

export async function listConversations(userId: string, role: 'all' | 'buying' | 'selling'): Promise<ConversationSummary[]> {
  const me = toObjectId(userId);
  const filter: QueryFilter<ConversationDoc> =
    role === 'buying' ? { buyerId: me } : role === 'selling' ? { sellerId: me } : { $or: [{ buyerId: me }, { sellerId: me }] };
  const conversations = await Conversation.find(filter).sort({ lastMessageAt: -1 }).limit(100).lean<ConversationDoc[]>();
  return summaries(userId, conversations);
}

export async function getConversation(userId: string, conversationId: string): Promise<ConversationSummary> {
  const conversation = await participantConversation(userId, conversationId);
  const [summary] = await summaries(userId, [conversation]);
  return summary!;
}

/** Newest page first from the database, returned oldest-to-newest for rendering. */
export async function conversationMessages(
  userId: string,
  conversationId: string,
  query: { before?: string; limit: number },
): Promise<CursorPage<MarketMessageDto>> {
  const conversation = await participantConversation(userId, conversationId);
  const filter: QueryFilter<MarketMessageDoc> = { conversationId: conversation._id };
  if (query.before) filter._id = { $lt: toObjectId(query.before) };
  const docs = await MarketMessage.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean<MarketMessageDoc[]>();
  const page = docs.slice(0, query.limit);
  return {
    items: page.reverse().map((doc) => toMessage(doc, userId)),
    nextCursor: docs.length > query.limit ? String(page[0]!._id) : null,
  };
}

export async function markConversationRead(userId: string, conversationId: string): Promise<void> {
  const conversation = await participantConversation(userId, conversationId);
  const readAt = new Date();
  const side = conversation.role;
  await Conversation.updateOne({ _id: conversation._id }, { $set: { [`${side}Unread`]: 0, [`${side}ReadAt`]: readAt } });
  const counterpartId = String(side === 'buyer' ? conversation.sellerId : conversation.buyerId);
  publishSafely(counterpartId, { type: 'market.read', data: { conversationId, readAt: readAt.toISOString() } });
}

/** Threads with something unread — the number on the header's message icon. */
export function marketUnreadCount(userId: string): Promise<number> {
  const me = toObjectId(userId);
  return Conversation.countDocuments({
    $or: [
      { buyerId: me, buyerUnread: { $gt: 0 } },
      { sellerId: me, sellerUnread: { $gt: 0 } },
    ],
  });
}

export function conversationCount(listingId: Types.ObjectId): Promise<number> {
  return Conversation.countDocuments({ listingId });
}
