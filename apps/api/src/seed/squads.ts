import { logger } from '../core/logger';
import { applyToClan, createClan, decideApplication, setMemberRole, updateClan } from '../modules/squads/clans.service';
import { applyToLfg, createLfg, decideLfg } from '../modules/squads/lfg.service';
import { Clan, ClanRequest, LfgRequest } from '../modules/squads/squads.model';
import { CLANS, LFG_POSTS } from './data/squads';

/**
 * Demo clans and teammate posts, created through the real services so
 * membership counts, clan XP and notifications come out exactly as in use.
 */
export async function seedSquads(userIds: Map<string, string>, gameIds: Map<string, string>): Promise<void> {
  const id = (username: string) => userIds.get(username)!;
  // Older dev databases may lack a newer demo player; skip what can't be built.
  const known = (...usernames: string[]) => usernames.every((username) => userIds.has(username));

  for (const clan of CLANS) {
    if (!known(clan.owner, ...clan.officers, ...clan.members, ...clan.pending) || (await Clan.exists({ tag: clan.tag }))) continue;
    const ownerId = id(clan.owner);
    // Applications are taken as "request" so every member goes through the real accept flow.
    const created = await createClan(ownerId, {
      tag: clan.tag,
      name: clan.name,
      color: clan.color,
      description: clan.description,
      joinPolicy: clan.joinPolicy === 'open' ? 'open' : 'request',
      country: clan.country,
      gameIds: clan.games.map((slug) => gameIds.get(slug)!).filter(Boolean),
    });
    for (const username of [...clan.officers, ...clan.members]) {
      const userId = id(username);
      await applyToClan(userId, created.tag, '');
      const request = await ClanRequest.findOne({ userId, status: 'pending' }).lean();
      if (request) await decideApplication(ownerId, created.tag, String(request._id), true);
    }
    for (const username of clan.officers) await setMemberRole(ownerId, created.tag, id(username), 'officer');
    for (const username of clan.pending) await applyToClan(id(username), created.tag, 'Played with a few of you in deathmatch — would love to join scrims.');
    if (clan.joinPolicy === 'closed') await updateClan(ownerId, created.tag, { joinPolicy: 'closed' });
  }

  for (const post of LFG_POSTS) {
    if (!known(post.author, ...(post.accepted ?? []), ...(post.pending ?? []))) continue;
    const authorId = id(post.author);
    const created = await createLfg(authorId, {
      gameId: gameIds.get(post.game)!,
      platform: post.platform,
      mode: post.mode,
      rank: post.rank,
      slots: post.slots,
      languages: post.languages,
      micRequired: post.micRequired,
      note: post.note,
      contact: post.contact,
      durationHours: post.durationHours,
    });
    for (const username of [...(post.accepted ?? []), ...(post.pending ?? [])]) {
      await applyToLfg(id(username), created.id, { message: 'Down to play tonight.', contact: `Discord: ${username}` });
    }
    for (const username of post.accepted ?? []) {
      const request = await LfgRequest.findOne({ postId: created.id, userId: id(username) }).lean();
      if (request) await decideLfg(authorId, created.id, String(request._id), true);
    }
  }
  logger.info({ clans: CLANS.length, posts: LFG_POSTS.length }, 'Squads seeded');
}
