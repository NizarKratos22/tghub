import { Router } from 'express';
import {
  MARKET_CATEGORIES,
  savedSearchSchema,
  savedSearchUpdateSchema,
  objectIdSchema,
  ratingReplySchema,
  sellerRatingSchema,
  usernameSchema,
  adminListingQuerySchema,
  adminListingUpdateSchema,
  conversationListQuerySchema,
  idParamsSchema,
  listingInputSchema,
  listingReportSchema,
  listingStatusUpdateSchema,
  marketListQuerySchema,
  marketMessageSchema,
  messageHistoryQuerySchema,
  myListingsQuerySchema,
} from '@tgh/shared';
import { requireAuth, requireRole, requireVerifiedEmail } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { listingWriteLimiter, messageLimiter, typingLimiter } from '../../core/http/rate-limit';
import { z } from 'zod';
import { rateSeller, replyToRating, sellerRatings } from './reputation.service';
import { deleteSavedSearch, listSavedSearches, markSearchSeen, saveSearch, updateSavedSearch } from './searches.service';
import {
  conversationMessages,
  getConversation,
  listConversations,
  markConversationRead,
  messageSeller,
  sendMessage,
  signalTyping,
} from './conversations.service';
import {
  featuredListings,
  categoryCounts,
  createListing,
  deleteListing,
  getListing,
  listListings,
  myListings,
  recordListingView,
  renewListing,
  savedListings,
  setListingStatus,
  updateListing,
  viewerState,
} from './listings.service';
import { adminListingReports, adminListListings, adminUpdateListing, reportListing } from './moderation.service';

/**
 * Mounted at /market. Browsing is public; everything that writes or reads a
 * player's own data needs a session. Saving listings goes through the shared
 * bookmarks API (/me/bookmarks with targetType "listing").
 */
export const marketRouter = Router();

marketRouter.get('/listings', handle({ query: marketListQuerySchema }, ({ query }) => listListings(query)));
marketRouter.get('/featured', handle({ query: z.object({ category: z.enum(MARKET_CATEGORIES).optional() }) }, ({ query }) => featuredListings(query.category)));
marketRouter.get('/categories', handle({}, () => categoryCounts()));

marketRouter.post(
  '/listings',
  requireAuth,
  requireVerifiedEmail,
  listingWriteLimiter,
  handle({ body: listingInputSchema, status: 201 }, ({ body, user }) => createListing(user().userId, body)),
);

// Declared before "/listings/:id" style routes that could shadow them.
marketRouter.get('/me/listings', requireAuth, handle({ query: myListingsQuerySchema }, ({ query, user }) => myListings(user().userId, query.status)));
marketRouter.get('/saved', requireAuth, handle({}, ({ user }) => savedListings(user().userId)));

marketRouter.get('/listings/:id', handle({ params: idParamsSchema }, ({ params }) => getListing(params.id)));
marketRouter.get('/listings/:id/viewer', handle({ params: idParamsSchema }, ({ params, auth }) => viewerState(params.id, auth?.userId ?? null)));

marketRouter.post(
  '/listings/:id/view',
  requireAuth,
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await recordListingView(params.id, user().userId);
  }),
);

marketRouter.put(
  '/listings/:id',
  requireAuth,
  requireVerifiedEmail,
  listingWriteLimiter,
  handle({ params: idParamsSchema, body: listingInputSchema }, ({ params, body, user }) => updateListing(user().userId, params.id, body)),
);

marketRouter.patch(
  '/listings/:id/status',
  requireAuth,
  handle({ params: idParamsSchema, body: listingStatusUpdateSchema }, ({ params, body, user }) => setListingStatus(user().userId, params.id, body.status, body.buyerId)),
);

marketRouter.post('/listings/:id/renew', requireAuth, handle({ params: idParamsSchema }, ({ params, user }) => renewListing(user().userId, params.id)));

marketRouter.delete(
  '/listings/:id',
  requireAuth,
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await deleteListing(user().userId, params.id);
  }),
);

marketRouter.post(
  '/listings/:id/report',
  requireAuth,
  requireVerifiedEmail,
  handle({ params: idParamsSchema, body: listingReportSchema }, async ({ params, body, user }) => {
    await reportListing(user().userId, params.id, body);
  }),
);

marketRouter.post(
  '/listings/:id/messages',
  requireAuth,
  requireVerifiedEmail,
  messageLimiter,
  handle({ params: idParamsSchema, body: marketMessageSchema, status: 201 }, ({ params, body, user }) => messageSeller(user().userId, params.id, body.body)),
);

/* Saved searches: alerts when a new listing matches. */

marketRouter.get('/searches', requireAuth, handle({}, ({ user }) => listSavedSearches(user().userId)));
marketRouter.post('/searches', requireAuth, listingWriteLimiter, handle({ body: savedSearchSchema, status: 201 }, ({ body, user }) => saveSearch(user().userId, body)));
marketRouter.patch('/searches/:id', requireAuth, handle({ params: idParamsSchema, body: savedSearchUpdateSchema }, ({ params, body, user }) => updateSavedSearch(user().userId, params.id, body)));
marketRouter.post('/searches/:id/seen', requireAuth, handle({ params: idParamsSchema }, ({ params, user }) => markSearchSeen(user().userId, params.id)));
marketRouter.delete(
  '/searches/:id',
  requireAuth,
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await deleteSavedSearch(user().userId, params.id);
  }),
);

/* Seller ratings: the buyer the seller picked rates the sale; the seller may answer once. */

marketRouter.post(
  '/listings/:id/rating',
  requireAuth,
  listingWriteLimiter,
  handle({ params: idParamsSchema, body: sellerRatingSchema }, ({ params, body, user }) => rateSeller(user().userId, params.id, body)),
);
marketRouter.get(
  '/sellers/:username/ratings',
  handle({ params: z.object({ username: usernameSchema }), query: z.object({ before: objectIdSchema.optional() }) }, ({ params, query }) => sellerRatings(params.username, query.before)),
);
marketRouter.post(
  '/ratings/:id/reply',
  requireAuth,
  listingWriteLimiter,
  handle({ params: idParamsSchema, body: ratingReplySchema }, ({ params, body, user }) => replyToRating(user().userId, params.id, body.reply)),
);

/* Conversations */

marketRouter.get('/conversations', requireAuth, handle({ query: conversationListQuerySchema }, ({ query, user }) => listConversations(user().userId, query.role)));
marketRouter.get('/conversations/:id', requireAuth, handle({ params: idParamsSchema }, ({ params, user }) => getConversation(user().userId, params.id)));

marketRouter.get(
  '/conversations/:id/messages',
  requireAuth,
  handle({ params: idParamsSchema, query: messageHistoryQuerySchema }, ({ params, query, user }) => conversationMessages(user().userId, params.id, query)),
);

marketRouter.post(
  '/conversations/:id/messages',
  requireAuth,
  requireVerifiedEmail,
  messageLimiter,
  handle({ params: idParamsSchema, body: marketMessageSchema, status: 201 }, ({ params, body, user }) => sendMessage(user().userId, params.id, body.body)),
);

marketRouter.post(
  '/conversations/:id/typing',
  requireAuth,
  typingLimiter,
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await signalTyping(user().userId, params.id);
  }),
);

marketRouter.post(
  '/conversations/:id/read',
  requireAuth,
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await markConversationRead(user().userId, params.id);
  }),
);

/** Mounted at /admin/market. Moderators handle the report queue too. */
export const adminMarketRouter = Router();
adminMarketRouter.use(requireRole('admin', 'moderator'));

adminMarketRouter.get('/listings', handle({ query: adminListingQuerySchema }, ({ query }) => adminListListings(query)));
adminMarketRouter.patch(
  '/listings/:id',
  handle({ params: idParamsSchema, body: adminListingUpdateSchema }, ({ params, body }) => adminUpdateListing(params.id, body)),
);
adminMarketRouter.get('/listings/:id/reports', handle({ params: idParamsSchema }, ({ params }) => adminListingReports(params.id)));
