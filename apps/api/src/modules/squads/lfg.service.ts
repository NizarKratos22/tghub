import type { QueryFilter, Types } from 'mongoose';
import { LFG_MAX_OPEN_POSTS, type LfgListQuery, type LfgPost as LfgPostDto, type LfgPostInput, type LfgRequest as LfgRequestDto, type Page } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { paginate, skipFor, toObjectId } from '../../core/http/utils';
import { gameRefMap } from '../games/games.service';
import { User, type UserDoc } from '../users/user.model';
import { countryOf } from '../users/users.mapper';
import { clanTagsFor } from './clans.service';
import { GONE_PLAYER, lfgStatusOf, PLAYER_FIELDS, toLfgPost, toLfgRequest, toSquadPlayer, type PlayerSource } from './squads.mapper';
import { LfgPost, LfgRequest, type LfgPostDoc, type LfgRequestDoc } from './squads.model';

const PAGE_SIZE = 24;
const HOUR_MS = 60 * 60 * 1000;
/** Closed and expired posts stay reachable this long (notification links), then are purged. */
const KEEP_AFTER_EXPIRY_MS = 7 * 24 * HOUR_MS;

async function postsToDtos(posts: LfgPostDoc[], viewerId: string | null): Promise<LfgPostDto[]> {
  if (posts.length === 0) return [];
  const authorIds = [...new Set(posts.map((post) => String(post.authorId)))];
  const authored = viewerId ? posts.filter((post) => String(post.authorId) === viewerId).map((post) => post._id) : [];

  const [games, authors, clanTags, viewerRequests, pending] = await Promise.all([
    gameRefMap(posts.map((post) => post.gameId)),
    User.find({ _id: { $in: authorIds } }).select(PLAYER_FIELDS).lean<PlayerSource[]>(),
    clanTagsFor(authorIds),
    viewerId ? LfgRequest.find({ postId: { $in: posts.map((p) => p._id) }, userId: viewerId }).select('postId status').lean<LfgRequestDoc[]>() : [],
    authored.length > 0
      ? LfgRequest.aggregate<{ _id: Types.ObjectId; n: number }>([
          { $match: { postId: { $in: authored }, status: 'pending' } },
          { $group: { _id: '$postId', n: { $sum: 1 } } },
        ])
      : [],
  ]);
  const authorById = new Map(authors.map((author) => [String(author._id), toSquadPlayer(author)]));
  const requestByPost = new Map(viewerRequests.map((request) => [String(request.postId), request.status]));
  const pendingByPost = new Map(pending.map((row) => [String(row._id), row.n]));

  return posts.flatMap((post) => {
    const game = games.get(String(post.gameId));
    if (!game) return [];
    const authorId = String(post.authorId);
    return [
      toLfgPost(post, {
        game,
        author: { ...(authorById.get(authorId) ?? GONE_PLAYER), clanTag: clanTags.get(authorId) ?? null },
        viewerId,
        viewerRequest: requestByPost.get(String(post._id)) ?? null,
        pendingRequests: pendingByPost.get(String(post._id)) ?? 0,
      }),
    ];
  });
}

async function postById(id: string): Promise<LfgPostDoc> {
  const post = await LfgPost.findById(id).lean<LfgPostDoc>();
  if (!post) throw AppError.notFound('Squad post');
  return post;
}

async function authoredPost(userId: string, id: string): Promise<LfgPostDoc> {
  const post = await postById(id);
  if (String(post.authorId) !== userId) throw AppError.forbidden('Only the player who posted this can do that');
  return post;
}

async function single(post: LfgPostDoc, viewerId: string | null): Promise<LfgPostDto> {
  const [dto] = await postsToDtos([post], viewerId);
  if (!dto) throw AppError.notFound('Squad post');
  return dto;
}

export async function listLfg(query: LfgListQuery, viewerId: string | null): Promise<Page<LfgPostDto>> {
  let filter: QueryFilter<LfgPostDoc>;
  if (query.mine) {
    if (!viewerId) throw AppError.unauthorized();
    filter = { authorId: toObjectId(viewerId) };
  } else {
    filter = { status: 'open', expiresAt: { $gt: new Date() } };
    if (query.gameId) filter.gameId = toObjectId(query.gameId);
    if (query.platform) filter.platform = query.platform;
    if (query.language) filter.languages = query.language;
  }
  const [posts, total] = await Promise.all([
    LfgPost.find(filter).sort({ createdAt: -1 }).skip(skipFor(query.page, PAGE_SIZE)).limit(PAGE_SIZE).lean<LfgPostDoc[]>(),
    LfgPost.countDocuments(filter),
  ]);
  return paginate(await postsToDtos(posts, viewerId), total, query.page, PAGE_SIZE);
}

export async function getLfg(id: string, viewerId: string | null): Promise<LfgPostDto> {
  return single(await postById(id), viewerId);
}

export async function createLfg(userId: string, input: LfgPostInput): Promise<LfgPostDto> {
  const games = await gameRefMap([input.gameId]);
  if (!games.has(input.gameId)) {
    const message = 'Pick a game from the catalogue';
    throw AppError.unprocessable(message, { fields: { gameId: message } });
  }
  const now = new Date();
  const open = await LfgPost.find({ authorId: userId, status: 'open', expiresAt: { $gt: now } }).select('gameId').lean<LfgPostDoc[]>();
  if (open.some((post) => String(post.gameId) === input.gameId)) {
    throw AppError.conflict('You already have an open post for this game — close it first');
  }
  if (open.length >= LFG_MAX_OPEN_POSTS) {
    throw AppError.conflict(`You can have ${LFG_MAX_OPEN_POSTS} open posts at a time — close one first`);
  }

  const author = await User.findById(userId).select('country region').lean<Pick<UserDoc, 'country' | 'region'>>();
  const expiresAt = new Date(now.getTime() + input.durationHours * HOUR_MS);
  const post = await LfgPost.create({
    authorId: userId,
    gameId: input.gameId,
    platform: input.platform,
    mode: input.mode,
    rank: input.rank,
    slots: input.slots,
    languages: input.languages,
    micRequired: input.micRequired,
    note: input.note,
    contact: input.contact,
    country: author ? countryOf(author) : null,
    expiresAt,
    purgeAt: new Date(expiresAt.getTime() + KEEP_AFTER_EXPIRY_MS),
  });
  bus.emit('lfg.posted', { postId: String(post._id), userId, gameId: input.gameId, mode: input.mode, slots: input.slots });
  return single(post.toObject(), userId);
}

export async function closeLfg(userId: string, id: string): Promise<LfgPostDto> {
  const post = await authoredPost(userId, id);
  await LfgPost.updateOne({ _id: post._id }, { $set: { status: 'closed' } });
  // Nobody is left waiting on a squad that's gone.
  await LfgRequest.updateMany({ postId: post._id, status: 'pending' }, { $set: { status: 'declined', decidedAt: new Date() } });
  return getLfg(id, userId);
}

export async function applyToLfg(userId: string, id: string, input: { message: string; contact: string }): Promise<LfgPostDto> {
  const post = await postById(id);
  if (String(post.authorId) === userId) throw AppError.unprocessable("This is your own post — applications show up below it");
  if (lfgStatusOf(post) !== 'open') throw AppError.conflict('This squad is no longer looking for players');

  const existing = await LfgRequest.findOne({ postId: post._id, userId }).lean<LfgRequestDoc>();
  if (existing?.status === 'declined') throw AppError.conflict('The host passed on this one — try another squad');
  if (!existing) {
    let request: LfgRequestDoc;
    try {
      request = (await LfgRequest.create({ postId: post._id, userId, message: input.message, contact: input.contact, purgeAt: post.purgeAt })).toObject();
    } catch (error) {
      if (isDuplicateKeyError(error)) return single(post, userId);
      throw error;
    }
    const [applicant, games] = await Promise.all([
      User.findById(userId).select('displayName').lean<Pick<UserDoc, 'displayName'>>(),
      gameRefMap([post.gameId]),
    ]);
    bus.emit('lfg.application', {
      postId: id,
      authorId: String(post.authorId),
      applicantName: applicant?.displayName ?? 'A player',
      gameTitle: games.get(String(post.gameId))?.title ?? 'your game',
      requestId: String(request._id),
    });
  }
  return single(post, userId);
}

export async function withdrawFromLfg(userId: string, id: string): Promise<LfgPostDto> {
  const post = await postById(id);
  await LfgRequest.deleteOne({ postId: post._id, userId, status: 'pending' });
  return single(post, userId);
}

export async function listLfgRequests(userId: string, id: string): Promise<LfgRequestDto[]> {
  const post = await authoredPost(userId, id);
  const requests = await LfgRequest.find({ postId: post._id }).sort({ createdAt: 1 }).limit(200).lean<LfgRequestDoc[]>();
  const users = await User.find({ _id: { $in: requests.map((r) => r.userId) } }).select(PLAYER_FIELDS).lean<PlayerSource[]>();
  const userById = new Map(users.map((user) => [String(user._id), toSquadPlayer(user)]));
  const order = { pending: 0, accepted: 1, declined: 2 } as const;
  return requests
    .map((request) => toLfgRequest(request, userById.get(String(request.userId)) ?? GONE_PLAYER))
    .sort((a, b) => order[a.status] - order[b.status]);
}

export async function decideLfg(userId: string, id: string, requestId: string, accept: boolean): Promise<LfgRequestDto[]> {
  const post = await authoredPost(userId, id);
  const request = await LfgRequest.findOne({ _id: requestId, postId: post._id, status: 'pending' }).lean<LfgRequestDoc>();
  if (!request) throw AppError.notFound('Request');

  if (accept) {
    if (lfgStatusOf(post) !== 'open') throw AppError.conflict('This post is closed — reopen a new one to add players');
    // Conditional increment: two quick accepts can't overfill the squad.
    const updated = await LfgPost.findOneAndUpdate(
      { _id: post._id, status: 'open', filled: { $lt: post.slots } },
      { $inc: { filled: 1 } },
      { returnDocument: 'after' },
    ).lean<LfgPostDoc>();
    if (!updated) throw AppError.conflict('Your squad is already full');
    if (updated.filled >= updated.slots) await LfgPost.updateOne({ _id: post._id }, { $set: { status: 'full' } });
  }
  await LfgRequest.updateOne({ _id: request._id }, { $set: { status: accept ? 'accepted' : 'declined', decidedAt: new Date() } });

  const [author, games] = await Promise.all([User.findById(userId).select('displayName').lean<Pick<UserDoc, 'displayName'>>(), gameRefMap([post.gameId])]);
  bus.emit('lfg.application_decided', {
    postId: id,
    userId: String(request.userId),
    accepted: accept,
    gameTitle: games.get(String(post.gameId))?.title ?? 'the game',
    authorName: author?.displayName ?? 'The host',
  });
  return listLfgRequests(userId, id);
}
