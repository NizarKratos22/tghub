import type { QueryFilter, SortOrder, Types } from 'mongoose';
import {
  MAX_CLAN_MEMBERS,
  type ClanBadge,
  type ClanDetail,
  type ClanInput,
  type ClanListQuery,
  type ClanRole,
  type ClanSummary,
  type ClanUpdateInput,
  type Page,
} from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { escapeRegex, paginate, skipFor, toObjectId } from '../../core/http/utils';
import { logger } from '../../core/logger';
import { gameExists, gameRefMap } from '../games/games.service';
import { SeasonStat } from '../progression/progression.model';
import { activePulse } from '../progression/progression.service';
import { User, type UserDoc } from '../users/user.model';
import { GONE_PLAYER, PLAYER_FIELDS, toClanSummary, toSquadPlayer, type PlayerSource } from './squads.mapper';
import { Clan, ClanMember, ClanRequest, type ClanDoc, type ClanMemberDoc, type ClanRequestDoc } from './squads.model';

const PAGE_SIZE = 20;
const REAPPLY_AFTER_MS = 24 * 60 * 60 * 1000;
const ROLE_RANK: Record<ClanRole, number> = { owner: 3, officer: 2, member: 1 };

const SORTS: Record<ClanListQuery['sort'], Record<string, SortOrder>> = {
  season: { seasonXp: -1, xp: -1, _id: 1 },
  xp: { xp: -1, _id: 1 },
  members: { memberCount: -1, seasonXp: -1, _id: 1 },
  new: { createdAt: -1 },
};

async function clanByTag(tag: string): Promise<ClanDoc> {
  const clan = await Clan.findOne({ tag }).lean<ClanDoc>();
  if (!clan) throw AppError.notFound('Clan');
  return clan;
}

/** The actor's membership in this clan, at least `min` rank — or a 403. */
async function requireRank(clan: ClanDoc, userId: string, min: ClanRole): Promise<ClanMemberDoc> {
  const member = await ClanMember.findOne({ clanId: clan._id, userId }).lean<ClanMemberDoc>();
  if (!member || ROLE_RANK[member.role] < ROLE_RANK[min]) {
    throw AppError.forbidden(min === 'owner' ? 'Only the clan leader can do that' : 'Only the leader and officers can do that');
  }
  return member;
}

async function assertGames(ids: string[]) {
  const unique = [...new Set(ids)];
  const found = await Promise.all(unique.map((id) => gameExists(id)));
  if (found.includes(false)) {
    const message = 'Pick games from the catalogue';
    throw AppError.unprocessable(message, { fields: { gameIds: message } });
  }
  return unique;
}

/* ───────────── Reading ───────────── */

export async function listClans(query: ClanListQuery): Promise<Page<ClanSummary>> {
  const filter: QueryFilter<ClanDoc> = {};
  if (query.q) {
    const term = escapeRegex(query.q);
    filter.$or = [{ nameLower: { $regex: term.toLowerCase() } }, { tag: { $regex: `^${term.toUpperCase()}` } }];
  }
  if (query.gameId) filter.gameIds = toObjectId(query.gameId);
  if (query.country) filter.country = query.country;
  if (query.recruiting) {
    filter.joinPolicy = { $ne: 'closed' };
    filter.memberCount = { $lt: MAX_CLAN_MEMBERS };
  }
  const [clans, total] = await Promise.all([
    Clan.find(filter).sort(SORTS[query.sort]).skip(skipFor(query.page, PAGE_SIZE)).limit(PAGE_SIZE).lean<ClanDoc[]>(),
    Clan.countDocuments(filter),
  ]);
  const games = await gameRefMap(clans.flatMap((clan) => clan.gameIds));
  return paginate(
    clans.map((clan) => toClanSummary(clan, games)),
    total,
    query.page,
    PAGE_SIZE,
  );
}

export async function clanBadgeFor(userId: string): Promise<ClanBadge | null> {
  const member = await ClanMember.findOne({ userId }).lean<ClanMemberDoc>();
  if (!member) return null;
  const clan = await Clan.findById(member.clanId).select('tag name color').lean<Pick<ClanDoc, 'tag' | 'name' | 'color'>>();
  return clan ? { tag: clan.tag, name: clan.name, color: clan.color, role: member.role } : null;
}

/** Clan tags for a batch of players (LFG author cards). */
export async function clanTagsFor(userIds: Array<string | Types.ObjectId>): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const members = await ClanMember.find({ userId: { $in: userIds } }).select('userId clanId').lean<ClanMemberDoc[]>();
  const clans = await Clan.find({ _id: { $in: members.map((m) => m.clanId) } }).select('tag').lean<Array<Pick<ClanDoc, '_id' | 'tag'>>>();
  const tagById = new Map(clans.map((clan) => [String(clan._id), clan.tag]));
  return new Map(members.flatMap((m) => (tagById.has(String(m.clanId)) ? [[String(m.userId), tagById.get(String(m.clanId))!]] : [])));
}

export async function getClan(tag: string, viewerId: string | null): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  const [members, viewerMembership, viewerRequest, games] = await Promise.all([
    ClanMember.find({ clanId: clan._id }).lean<ClanMemberDoc[]>(),
    viewerId ? ClanMember.findOne({ userId: viewerId }).lean<ClanMemberDoc>() : null,
    viewerId ? ClanRequest.findOne({ clanId: clan._id, userId: viewerId, status: 'pending' }).lean<ClanRequestDoc>() : null,
    gameRefMap(clan.gameIds),
  ]);

  const viewerRole = viewerMembership && String(viewerMembership.clanId) === String(clan._id) ? viewerMembership.role : null;
  const canManage = viewerRole === 'owner' || viewerRole === 'officer';
  const requests = canManage
    ? await ClanRequest.find({ clanId: clan._id, status: 'pending' }).sort({ createdAt: 1 }).limit(100).lean<ClanRequestDoc[]>()
    : [];

  const users = await User.find({ _id: { $in: [...members.map((m) => m.userId), ...requests.map((r) => r.userId)] } })
    .select(PLAYER_FIELDS)
    .lean<PlayerSource[]>();
  const playerById = new Map(users.map((user) => [String(user._id), toSquadPlayer(user)]));

  let otherClan: ClanDetail['viewer']['otherClan'] = null;
  if (viewerMembership && !viewerRole) {
    const other = await Clan.findById(viewerMembership.clanId).select('tag name').lean<Pick<ClanDoc, 'tag' | 'name'>>();
    if (other) otherClan = { tag: other.tag, name: other.name };
  }

  const sortedMembers = [...members].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.joinedAt.getTime() - b.joinedAt.getTime());
  return {
    ...toClanSummary(clan, games),
    members: sortedMembers.map((member) => ({
      user: playerById.get(String(member.userId)) ?? GONE_PLAYER,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
    viewer: { role: viewerRole, otherClan, requestPending: Boolean(viewerRequest) },
    requests: requests.flatMap((request) => {
      const user = playerById.get(String(request.userId));
      return user ? [{ id: String(request._id), user, message: request.message, createdAt: request.createdAt.toISOString() }] : [];
    }),
  };
}

/* ───────────── Membership ───────────── */

/** Takes a seat atomically: the count can't pass the cap, and the unique userId keeps players in one clan. */
async function addMember(clan: Pick<ClanDoc, '_id' | 'tag' | 'name' | 'color'>, userId: string, role: ClanRole): Promise<void> {
  const seat = await Clan.updateOne({ _id: clan._id, memberCount: { $lt: MAX_CLAN_MEMBERS } }, { $inc: { memberCount: 1 } });
  if (seat.modifiedCount === 0) throw AppError.conflict(`This clan is full (${MAX_CLAN_MEMBERS} members)`);
  try {
    await ClanMember.create({ clanId: clan._id, userId, role });
  } catch (error) {
    await Clan.updateOne({ _id: clan._id }, { $inc: { memberCount: -1 } });
    if (isDuplicateKeyError(error)) throw new AppError(409, 'ALREADY_IN_CLAN', 'That player is already in a clan');
    throw error;
  }
  // Other applications are moot once a player has a clan.
  await ClanRequest.deleteMany({ userId, status: 'pending' });
  await refreshClanXp([clan._id]);
  bus.emit('clan.joined', { userId, clanTag: clan.tag, clanName: clan.name, color: clan.color, founded: false });
}

async function dropMember(clan: Pick<ClanDoc, '_id'>, userId: string | Types.ObjectId): Promise<void> {
  const removed = await ClanMember.deleteOne({ clanId: clan._id, userId });
  if (removed.deletedCount > 0) {
    await Clan.updateOne({ _id: clan._id }, { $inc: { memberCount: -1 } });
    await refreshClanXp([clan._id]);
  }
}

export async function createClan(userId: string, input: ClanInput): Promise<ClanDetail> {
  const current = await clanBadgeFor(userId);
  if (current) throw AppError.conflict(`You're already in [${current.tag}] ${current.name} — leave it first`);
  const gameIds = await assertGames(input.gameIds);

  let clan: ClanDoc;
  try {
    clan = (
      await Clan.create({
        tag: input.tag,
        name: input.name,
        nameLower: input.name.toLowerCase(),
        color: input.color,
        description: input.description,
        joinPolicy: input.joinPolicy,
        country: input.country,
        gameIds,
        ownerId: userId,
        memberCount: 1,
      })
    ).toObject();
  } catch (error) {
    if (isDuplicateKeyError(error)) throw AppError.conflict('That tag is taken', { fields: { tag: 'That tag is taken' } });
    throw error;
  }

  try {
    await ClanMember.create({ clanId: clan._id, userId, role: 'owner' });
  } catch (error) {
    // Joined another clan in the meantime.
    await Clan.deleteOne({ _id: clan._id });
    if (isDuplicateKeyError(error)) throw AppError.conflict("You're already in a clan");
    throw error;
  }
  await ClanRequest.deleteMany({ userId, status: 'pending' });
  await refreshClanXp([clan._id]);
  bus.emit('clan.joined', { userId, clanTag: clan.tag, clanName: clan.name, color: clan.color, founded: true });
  return getClan(clan.tag, userId);
}

export async function updateClan(userId: string, tag: string, input: ClanUpdateInput): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  await requireRank(clan, userId, 'officer');
  const set: Partial<ClanDoc> = {};
  if (input.name !== undefined) Object.assign(set, { name: input.name, nameLower: input.name.toLowerCase() });
  if (input.description !== undefined) set.description = input.description;
  if (input.color !== undefined) set.color = input.color;
  if (input.joinPolicy !== undefined) set.joinPolicy = input.joinPolicy;
  if (input.country !== undefined) set.country = input.country;
  if (input.gameIds !== undefined) set.gameIds = (await assertGames(input.gameIds)).map(toObjectId);
  await Clan.updateOne({ _id: clan._id }, { $set: set });
  return getClan(tag, userId);
}

/** Open clans take the player straight away; the rest get an application. */
export async function applyToClan(userId: string, tag: string, message: string): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  const current = await ClanMember.findOne({ userId }).lean<ClanMemberDoc>();
  if (current) {
    throw AppError.conflict(String(current.clanId) === String(clan._id) ? "You're already in this clan" : 'Leave your current clan before joining another');
  }
  if (clan.joinPolicy === 'closed') throw AppError.forbidden("This clan isn't recruiting right now");
  if (clan.memberCount >= MAX_CLAN_MEMBERS) throw AppError.conflict('This clan is full');

  if (clan.joinPolicy === 'open') {
    await addMember(clan, userId, 'member');
    return getClan(tag, userId);
  }

  const previous = await ClanRequest.findOne({ clanId: clan._id, userId }).lean<ClanRequestDoc>();
  if (previous?.status === 'pending') return getClan(tag, userId);
  if (previous?.status === 'declined' && previous.decidedAt && Date.now() - previous.decidedAt.getTime() < REAPPLY_AFTER_MS) {
    throw new AppError(429, 'APPLY_COOLDOWN', 'Your last application was declined — you can apply again tomorrow');
  }
  await ClanRequest.deleteOne({ clanId: clan._id, userId });
  const request = await ClanRequest.create({ clanId: clan._id, userId, message });

  const [applicant, leaders] = await Promise.all([
    User.findById(userId).select('displayName').lean<Pick<UserDoc, 'displayName'>>(),
    ClanMember.find({ clanId: clan._id, role: { $in: ['owner', 'officer'] } }).select('userId').lean<ClanMemberDoc[]>(),
  ]);
  bus.emit('clan.application', {
    clanTag: clan.tag,
    clanName: clan.name,
    requestId: String(request._id),
    applicantName: applicant?.displayName ?? 'A player',
    recipientIds: leaders.map((leader) => String(leader.userId)),
  });
  return getClan(tag, userId);
}

export async function withdrawApplication(userId: string, tag: string): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  await ClanRequest.deleteOne({ clanId: clan._id, userId, status: 'pending' });
  return getClan(tag, userId);
}

export async function decideApplication(actorId: string, tag: string, requestId: string, accept: boolean): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  await requireRank(clan, actorId, 'officer');
  const request = await ClanRequest.findOne({ _id: requestId, clanId: clan._id, status: 'pending' }).lean<ClanRequestDoc>();
  if (!request) throw AppError.notFound('Application');
  const applicantId = String(request.userId);

  if (accept) {
    try {
      await addMember(clan, applicantId, 'member');
    } catch (error) {
      // They joined somewhere else meanwhile: the application is void either way.
      if (error instanceof AppError && error.code === 'ALREADY_IN_CLAN') await ClanRequest.deleteOne({ _id: request._id });
      throw error;
    }
    await ClanRequest.deleteOne({ _id: request._id });
  } else {
    await ClanRequest.updateOne({ _id: request._id }, { $set: { status: 'declined', decidedAt: new Date() } });
  }
  bus.emit('clan.application_decided', { clanTag: clan.tag, clanName: clan.name, userId: applicantId, accepted: accept });
  return getClan(tag, actorId);
}

export async function leaveClan(userId: string, tag: string): Promise<void> {
  const clan = await clanByTag(tag);
  const member = await ClanMember.findOne({ clanId: clan._id, userId }).lean<ClanMemberDoc>();
  if (!member) throw AppError.notFound('Membership');
  if (member.role === 'owner') {
    if (clan.memberCount > 1) throw AppError.unprocessable('Make someone else leader before you leave — or disband the clan');
    await disband(clan);
    return;
  }
  await dropMember(clan, userId);
}

export async function removeMember(actorId: string, tag: string, targetId: string): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  const actor = await requireRank(clan, actorId, 'officer');
  if (actorId === targetId) throw AppError.unprocessable('Use "Leave clan" to remove yourself');
  const target = await ClanMember.findOne({ clanId: clan._id, userId: targetId }).lean<ClanMemberDoc>();
  if (!target) throw AppError.notFound('Member');
  if (ROLE_RANK[actor.role] <= ROLE_RANK[target.role]) throw AppError.forbidden('You can only remove players below your rank');
  await dropMember(clan, targetId);
  bus.emit('clan.member_removed', { clanTag: clan.tag, clanName: clan.name, userId: targetId });
  return getClan(tag, actorId);
}

export async function setMemberRole(actorId: string, tag: string, targetId: string, role: 'officer' | 'member'): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  await requireRank(clan, actorId, 'owner');
  const result = await ClanMember.updateOne({ clanId: clan._id, userId: targetId, role: { $ne: 'owner' } }, { $set: { role } });
  if (result.matchedCount === 0) throw AppError.notFound('Member');
  return getClan(tag, actorId);
}

export async function transferLeadership(actorId: string, tag: string, targetId: string): Promise<ClanDetail> {
  const clan = await clanByTag(tag);
  await requireRank(clan, actorId, 'owner');
  if (actorId === targetId) throw AppError.unprocessable("You're already the leader");
  const promoted = await ClanMember.updateOne({ clanId: clan._id, userId: targetId }, { $set: { role: 'owner' } });
  if (promoted.matchedCount === 0) throw AppError.notFound('Member');
  await ClanMember.updateOne({ clanId: clan._id, userId: actorId }, { $set: { role: 'officer' } });
  await Clan.updateOne({ _id: clan._id }, { $set: { ownerId: toObjectId(targetId) } });
  return getClan(tag, actorId);
}

async function disband(clan: Pick<ClanDoc, '_id'>) {
  await Promise.all([ClanMember.deleteMany({ clanId: clan._id }), ClanRequest.deleteMany({ clanId: clan._id })]);
  await Clan.deleteOne({ _id: clan._id });
}

export async function disbandClan(actorId: string, tag: string): Promise<void> {
  const clan = await clanByTag(tag);
  await requireRank(clan, actorId, 'owner');
  await disband(clan);
}

/* ───────────── Clan XP ───────────── */

/**
 * Recomputes members' combined XP (and the member count) from the source of
 * truth. Runs on membership changes, on season rollover, and as a periodic
 * job; awards in between are applied incrementally by `onXpAwarded`.
 */
export async function refreshClanXp(clanIds?: Types.ObjectId[]): Promise<{ clans: number }> {
  const season = await activePulse();
  const members = await ClanMember.find(clanIds ? { clanId: { $in: clanIds } } : {})
    .select('clanId userId')
    .lean<Array<Pick<ClanMemberDoc, 'clanId' | 'userId'>>>();
  const userIds = members.map((m) => m.userId);
  const [users, stats] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('xp').lean<Array<Pick<UserDoc, '_id' | 'xp'>>>(),
    season ? SeasonStat.find({ seasonKey: season.key, userId: { $in: userIds } }).select('userId xp').lean() : [],
  ]);
  const xpByUser = new Map(users.map((u) => [String(u._id), u.xp]));
  const seasonByUser = new Map(stats.map((s) => [String(s.userId), s.xp]));

  const totals = new Map<string, { xp: number; seasonXp: number; count: number }>();
  for (const id of clanIds ?? []) totals.set(String(id), { xp: 0, seasonXp: 0, count: 0 });
  for (const member of members) {
    const key = String(member.clanId);
    const total = totals.get(key) ?? { xp: 0, seasonXp: 0, count: 0 };
    total.xp += xpByUser.get(String(member.userId)) ?? 0;
    total.seasonXp += seasonByUser.get(String(member.userId)) ?? 0;
    total.count += 1;
    totals.set(key, total);
  }
  if (totals.size === 0) return { clans: 0 };
  await Clan.bulkWrite(
    [...totals].map(([id, total]) => ({
      updateOne: {
        filter: { _id: toObjectId(id) },
        update: { $set: { xp: total.xp, seasonXp: total.seasonXp, seasonKey: season?.key ?? null, memberCount: total.count } },
      },
    })),
  );
  return { clans: totals.size };
}

/** Keeps clan standings live as members earn XP. */
export async function onXpAwarded({ userId, amount, seasonKey }: { userId: string; amount: number; seasonKey: string | null }): Promise<void> {
  const member = await ClanMember.findOne({ userId }).select('clanId').lean<Pick<ClanMemberDoc, 'clanId'>>();
  if (!member) return;
  const result = await Clan.updateOne({ _id: member.clanId, seasonKey }, { $inc: { xp: amount, seasonXp: seasonKey ? amount : 0 } });
  // A different season on record means it rolled over: recount from scratch.
  if (result.matchedCount === 0) {
    await refreshClanXp([member.clanId]).catch((error: unknown) => logger.warn({ err: error }, 'Clan XP refresh failed'));
  }
}
