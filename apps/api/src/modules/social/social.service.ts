import type { QueryFilter, Types } from 'mongoose';
import { MAX_FOLLOWING, type Activity as ActivityDto, type ActivityType, type CursorPage, type FollowStatus, type PlayerCard } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { toObjectId } from '../../core/http/utils';
import { PLAYER_FIELDS, toSquadPlayer, type PlayerSource } from '../squads/squads.mapper';
import { User, type UserDoc } from '../users/user.model';
import { Activity, ActivityGg, Follow, type ActivityDoc, type ActivityVisual, type FollowDoc } from './social.model';

const FEED_PAGE = 20;
const LIST_PAGE = 30;

async function activeUser(username: string): Promise<UserDoc> {
  const user = await User.findOne({ usernameLower: username.toLowerCase(), status: 'active' }).lean<UserDoc>();
  if (!user) throw AppError.notFound('Player');
  return user;
}

/* ───────────── Following ───────────── */

export async function followStatus(viewerId: string | null, username: string): Promise<FollowStatus> {
  const user = await activeUser(username);
  const [following, followsYou] = viewerId
    ? await Promise.all([Follow.exists({ followerId: viewerId, followeeId: user._id }), Follow.exists({ followerId: user._id, followeeId: viewerId })])
    : [null, null];
  return { following: Boolean(following), followsYou: Boolean(followsYou), followers: user.followerCount ?? 0 };
}

export async function follow(followerId: string, username: string): Promise<FollowStatus> {
  const target = await activeUser(username);
  if (String(target._id) === followerId) throw AppError.unprocessable("You can't follow yourself");
  const count = await Follow.countDocuments({ followerId });
  if (count >= MAX_FOLLOWING) throw AppError.unprocessable(`You can follow up to ${MAX_FOLLOWING} players`);

  try {
    await Follow.create({ followerId, followeeId: target._id });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return followStatus(followerId, username);
  }
  await Promise.all([
    User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
    User.updateOne({ _id: target._id }, { $inc: { followerCount: 1 } }),
  ]);
  const follower = await User.findById(followerId).select('username displayName').lean<Pick<UserDoc, 'username' | 'displayName'>>();
  if (follower) {
    bus.emit('social.followed', { followerId, followerName: follower.displayName, followerUsername: follower.username, followeeId: String(target._id) });
  }
  return followStatus(followerId, username);
}

export async function unfollow(followerId: string, username: string): Promise<FollowStatus> {
  const target = await activeUser(username);
  const removed = await Follow.deleteOne({ followerId, followeeId: target._id });
  if (removed.deletedCount > 0) {
    await Promise.all([
      User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }),
      User.updateOne({ _id: target._id }, { $inc: { followerCount: -1 } }),
    ]);
  }
  return followStatus(followerId, username);
}

async function playerCards(ids: Types.ObjectId[]): Promise<Map<string, PlayerCard>> {
  const users = await User.find({ _id: { $in: ids }, status: 'active' }).select(PLAYER_FIELDS).lean<PlayerSource[]>();
  return new Map(users.map((user) => [String(user._id), toSquadPlayer(user)]));
}

/** Followers or following, newest first. */
export async function followList(username: string, direction: 'followers' | 'following', before?: string): Promise<CursorPage<PlayerCard>> {
  const user = await activeUser(username);
  const filter: QueryFilter<FollowDoc> = direction === 'followers' ? { followeeId: user._id } : { followerId: user._id };
  if (before) filter._id = { $lt: toObjectId(before) };
  const rows = await Follow.find(filter).sort({ _id: -1 }).limit(LIST_PAGE + 1).lean<FollowDoc[]>();
  const page = rows.slice(0, LIST_PAGE);
  const ids = page.map((row) => (direction === 'followers' ? row.followerId : row.followeeId));
  const cards = await playerCards(ids);
  return {
    items: ids.flatMap((id) => cards.get(String(id)) ?? []),
    nextCursor: rows.length > LIST_PAGE ? String(page.at(-1)!._id) : null,
  };
}

/** Strong players you don't follow yet, from your country first. */
export async function suggestions(userId: string, limit = 5): Promise<PlayerCard[]> {
  const [me, following] = await Promise.all([
    User.findById(userId).select('country region').lean<Pick<UserDoc, 'country' | 'region'>>(),
    Follow.find({ followerId: userId }).select('followeeId').lean<FollowDoc[]>(),
  ]);
  const exclude = [toObjectId(userId), ...following.map((row) => row.followeeId)];
  const candidates = await User.find({ _id: { $nin: exclude }, status: 'active' }).sort({ xp: -1 }).limit(40).select(PLAYER_FIELDS).lean<PlayerSource[]>();
  const cards = candidates.map(toSquadPlayer);
  const country = me?.country ?? 'TN';
  return [...cards.filter((card) => card.country === country), ...cards.filter((card) => card.country !== country)].slice(0, limit);
}

/* ───────────── Activity ───────────── */

export interface ActivityInput {
  actorId: string;
  type: ActivityType;
  text: string;
  value?: number | null;
  target?: { label: string; href: string } | null;
  detail?: string | null;
  visual?: ActivityVisual;
  dedupKey?: string;
}

/** Writes an activity unless the player keeps theirs private, or it was already recorded. */
export async function recordActivity(input: ActivityInput): Promise<void> {
  const actor = await User.findById(input.actorId).select('shareActivity status').lean<Pick<UserDoc, 'shareActivity' | 'status'>>();
  if (!actor || actor.status !== 'active' || actor.shareActivity === false) return;
  try {
    await Activity.create({
      actorId: input.actorId,
      type: input.type,
      text: input.text,
      value: input.value ?? null,
      target: input.target ?? null,
      detail: input.detail ?? null,
      visual: input.visual ?? null,
      dedupKey: input.dedupKey ?? null,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

/** Rows written before `value` existed carry the number only inside their English text. */
function legacyValue(doc: ActivityDoc): number | null {
  const digits = (text: string | null | undefined) => {
    const match = text?.replace(/,/g, '').match(/\d+/);
    return match ? Number(match[0]) : null;
  };
  if (doc.type === 'level_up') return digits(doc.visual?.kind === 'mark' ? doc.visual.label : doc.text);
  if (doc.type === 'lfg_posted') return /a teammate/.test(doc.text) ? 1 : digits(doc.text);
  if (doc.type === 'listing') return digits(doc.detail);
  return null;
}

async function toActivities(docs: ActivityDoc[], viewerId: string | null): Promise<ActivityDto[]> {
  if (docs.length === 0) return [];
  const [actors, ggs] = await Promise.all([
    User.find({ _id: { $in: docs.map((d) => d.actorId) }, status: 'active' })
      .select(`${PLAYER_FIELDS} shareActivity`)
      .lean<Array<PlayerSource & Pick<UserDoc, 'shareActivity'>>>(),
    viewerId ? ActivityGg.find({ activityId: { $in: docs.map((d) => d._id) }, userId: viewerId }).select('activityId').lean() : [],
  ]);
  // Players who went private disappear from other people's feeds at once.
  const actorById = new Map(actors.filter((a) => a.shareActivity !== false || String(a._id) === viewerId).map((a) => [String(a._id), toSquadPlayer(a)]));
  const ggSet = new Set(ggs.map((gg) => String(gg.activityId)));
  return docs.flatMap((doc) => {
    const actor = actorById.get(String(doc.actorId));
    if (!actor) return [];
    return [
      {
        id: String(doc._id),
        type: doc.type,
        actor,
        text: doc.text,
        value: doc.value ?? legacyValue(doc),
        target: doc.target,
        detail: doc.detail,
        visual: doc.visual,
        gg: doc.gg,
        ggByYou: ggSet.has(String(doc._id)),
        createdAt: doc.createdAt.toISOString(),
      },
    ];
  });
}

async function activityPage(filter: QueryFilter<ActivityDoc>, viewerId: string | null, before?: string): Promise<CursorPage<ActivityDto>> {
  if (before) filter._id = { $lt: toObjectId(before) };
  const docs = await Activity.find(filter).sort({ _id: -1 }).limit(FEED_PAGE + 1).lean<ActivityDoc[]>();
  const page = docs.slice(0, FEED_PAGE);
  return { items: await toActivities(page, viewerId), nextCursor: docs.length > FEED_PAGE ? String(page.at(-1)!._id) : null };
}

/** You and everyone you follow, newest first. */
export async function feed(userId: string, before?: string): Promise<CursorPage<ActivityDto>> {
  const following = await Follow.find({ followerId: userId }).select('followeeId').lean<FollowDoc[]>();
  return activityPage({ actorId: { $in: [toObjectId(userId), ...following.map((row) => row.followeeId)] } }, userId, before);
}

export async function playerActivity(username: string, viewerId: string | null, before?: string): Promise<CursorPage<ActivityDto>> {
  const user = await activeUser(username);
  if (user.shareActivity === false && String(user._id) !== viewerId) return { items: [], nextCursor: null };
  return activityPage({ actorId: user._id }, viewerId, before);
}

export async function toggleGg(userId: string, activityId: string): Promise<{ gg: number; ggByYou: boolean }> {
  const activity = await Activity.findById(activityId).select('_id').lean();
  if (!activity) throw AppError.notFound('Activity');
  const removed = await ActivityGg.deleteOne({ activityId, userId });
  let ggByYou = false;
  if (removed.deletedCount > 0) {
    await Activity.updateOne({ _id: activityId }, { $inc: { gg: -1 } });
  } else {
    try {
      await ActivityGg.create({ activityId, userId });
      await Activity.updateOne({ _id: activityId }, { $inc: { gg: 1 } });
      ggByYou = true;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      ggByYou = true;
    }
  }
  const updated = await Activity.findById(activityId).select('gg').lean<Pick<ActivityDoc, 'gg'>>();
  return { gg: Math.max(0, updated?.gg ?? 0), ggByYou };
}
