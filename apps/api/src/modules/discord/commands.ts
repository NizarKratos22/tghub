import { CLAN_ROLE_LABELS, countryName, LFG_LANGUAGE_LABELS, PLATFORM_LABELS } from '@tgh/shared';
import { env } from '../../config/env';
import { AppError } from '../../core/http/errors';
import { escapeRegex } from '../../core/http/utils';
import { Connection, type ConnectionDoc } from '../connections/connections.model';
import { Game, type GameDoc } from '../games/game.model';
import { leaderboard } from '../progression/progression.service';
import { getClan } from '../squads/clans.service';
import { listLfg } from '../squads/lfg.service';
import { User, type UserDoc } from '../users/user.model';
import { getPublicProfile } from '../users/users.service';


const BRAND = 0xe10600;
const EPHEMERAL = 64;
const OPTION = { SUB_COMMAND: 1, STRING: 3 } as const;

/** The one slash command TG Hub registers, with subcommands. */
export const SLASH_COMMANDS = [
  {
    name: 'tgh',
    description: 'TG Hub — players, clans and teammates',
    options: [
      {
        type: OPTION.SUB_COMMAND,
        name: 'profile',
        description: "A player's level, season rank and clan",
        options: [{ type: OPTION.STRING, name: 'player', description: 'TG Hub username (yours if you leave it empty)', required: false }],
      },
      {
        type: OPTION.SUB_COMMAND,
        name: 'clan',
        description: 'A clan and its season standing',
        options: [{ type: OPTION.STRING, name: 'tag', description: 'Clan tag, e.g. CRTG', required: true }],
      },
      {
        type: OPTION.SUB_COMMAND,
        name: 'lfg',
        description: 'Players looking for teammates right now',
        options: [{ type: OPTION.STRING, name: 'game', description: 'Game name', required: false }],
      },
      { type: OPTION.SUB_COMMAND, name: 'top', description: 'Season leaderboard — top 10' },
      { type: OPTION.SUB_COMMAND, name: 'link', description: 'Connect this Discord account to TG Hub' },
    ],
  },
] as const;

/* ── Discord payload shapes (only the fields used) ── */

interface CommandOption {
  name: string;
  type: number;
  value?: string;
  options?: CommandOption[];
}

export interface Interaction {
  type: number;
  data?: { name: string; options?: CommandOption[] };
  member?: { user?: { id: string } };
  user?: { id: string };
}

interface Embed {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  thumbnail?: { url: string };
}

export type InteractionResponse = { type: 1 } | { type: 4; data: { content?: string; embeds?: Embed[]; flags?: number } };

const site = (path: string) => `${env.PUBLIC_WEB_URL}${path}`;
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const reply = (embed: Embed, flags?: number): InteractionResponse => ({ type: 4, data: { embeds: [{ color: BRAND, ...embed }], ...(flags ? { flags } : {}) } });
const notice = (content: string): InteractionResponse => ({ type: 4, data: { content, flags: EPHEMERAL } });

/** Absolute URL for images (Discord can't load our relative media paths). */
const absolute = (url: string | null) => (url ? (url.startsWith('http') ? url : site(url)) : undefined);

async function linkedUser(discordId: string | undefined): Promise<Pick<UserDoc, 'username'> | null> {
  if (!discordId) return null;
  const connection = await Connection.findOne({ provider: 'discord', externalId: discordId }).select('userId').lean<Pick<ConnectionDoc, 'userId'>>();
  if (!connection) return null;
  return User.findById(connection.userId).select('username').lean<Pick<UserDoc, 'username'>>();
}

async function profileCommand(username: string | undefined, discordId: string | undefined): Promise<InteractionResponse> {
  const name = username ?? (await linkedUser(discordId))?.username;
  if (!name) return notice(`Name a player (\`/tgh profile player:<name>\`) or link your Discord first: ${site('/settings')}`);
  try {
    const profile = await getPublicProfile(name);
    const user = profile.user;
    return reply({
      title: `${user.displayName} · Level ${user.level}`,
      url: site(`/u/${user.username}`),
      description: [user.title, user.bio].filter(Boolean).join(' — ') || undefined,
      thumbnail: user.avatarUrl ? { url: absolute(user.avatarUrl)! } : undefined,
      fields: [
        { name: 'Total XP', value: number(user.xp), inline: true },
        { name: 'Season', value: profile.seasonRank ? `#${profile.seasonRank} · ${number(profile.seasonXp)} XP` : 'Unranked', inline: true },
        { name: 'Clan', value: profile.clan ? `[${profile.clan.tag}] ${profile.clan.name} · ${CLAN_ROLE_LABELS[profile.clan.role]}` : '—', inline: true },
        { name: 'Followers', value: number(profile.followers), inline: true },
        { name: 'Home', value: user.country ? countryName(user.country) : '—', inline: true },
      ],
      footer: { text: 'TG Hub' },
    });
  } catch (error) {
    if (error instanceof AppError && error.status === 404) return notice(`No TG Hub player called **${name}**.`);
    throw error;
  }
}

async function clanCommand(tag: string): Promise<InteractionResponse> {
  const clean = tag.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(clean)) return notice('Clan tags are 2–5 letters or digits.');
  try {
    const clan = await getClan(clean, null);
    const leaders = clan.members.filter((m) => m.role !== 'member').map((m) => `${m.user.displayName} (${CLAN_ROLE_LABELS[m.role]})`);
    return reply({
      title: `[${clan.tag}] ${clan.name}`,
      url: site(`/clans/${clan.tag}`),
      description: clan.description || undefined,
      color: Number.parseInt(clan.color.slice(1), 16),
      fields: [
        { name: 'Season XP', value: number(clan.seasonXp), inline: true },
        { name: 'Members', value: `${clan.memberCount}`, inline: true },
        { name: 'Recruiting', value: clan.joinPolicy === 'open' ? 'Open' : clan.joinPolicy === 'request' ? 'Apply on TG Hub' : 'Closed', inline: true },
        ...(clan.games.length > 0 ? [{ name: 'Games', value: clan.games.map((g) => g.title).join(', ') }] : []),
        ...(leaders.length > 0 ? [{ name: 'Leadership', value: leaders.join(', ') }] : []),
      ],
    });
  } catch (error) {
    if (error instanceof AppError && error.status === 404) return notice(`No clan with the tag **${clean}**.`);
    throw error;
  }
}

async function lfgCommand(gameName: string | undefined): Promise<InteractionResponse> {
  let gameId: string | undefined;
  let gameTitle: string | undefined;
  if (gameName) {
    const game = await Game.findOne({ titleLower: { $regex: escapeRegex(gameName.trim().toLowerCase()) } }).select('_id title').lean<Pick<GameDoc, '_id' | 'title'>>();
    if (!game) return notice(`No game matching **${gameName}** in the catalogue.`);
    gameId = String(game._id);
    gameTitle = game.title;
  }
  const page = await listLfg({ gameId, page: 1 }, null);
  const posts = page.items.slice(0, 6);
  if (posts.length === 0) {
    return reply({ title: 'Nobody is looking right now', description: `Be the first — post a squad: ${site('/squads/new')}` });
  }
  return reply({
    title: gameTitle ? `Looking for teammates · ${gameTitle}` : 'Looking for teammates',
    url: site(gameId ? `/squads?game=${gameId}` : '/squads'),
    description: posts
      .map((post) => {
        const left = post.slots - post.filled;
        const voice = post.languages.map((l) => LFG_LANGUAGE_LABELS[l]).join(', ');
        return `**[${post.game.title} · ${post.mode}](${site(`/squads/${post.id}`)})**${post.rank ? ` (${post.rank})` : ''}\n${PLATFORM_LABELS[post.platform]} · ${left} spot${left === 1 ? '' : 's'} · ${voice} · by ${post.author.displayName}`;
      })
      .join('\n\n'),
    footer: { text: `${page.total} open post${page.total === 1 ? '' : 's'} on TG Hub` },
  });
}

async function topCommand(): Promise<InteractionResponse> {
  const rows = await leaderboard(10);
  if (rows.length === 0) return notice('No season is running right now.');
  const medals = ['🥇', '🥈', '🥉'];
  return reply({
    title: 'Season leaderboard',
    url: site('/universe'),
    description: rows.map((row) => `${medals[row.rank - 1] ?? `**${row.rank}.**`} [${row.user.displayName}](${site(`/u/${row.user.username}`)}) — ${number(row.xp)} XP · Lv ${row.user.level}`).join('\n'),
  });
}

async function linkCommand(discordId: string | undefined): Promise<InteractionResponse> {
  const user = await linkedUser(discordId);
  return user
    ? notice(`This Discord is linked to **${user.username}** — ${site(`/u/${user.username}`)}`)
    : notice(`Link your Discord in TG Hub settings to use \`/tgh profile\` without a name: ${site('/settings')}`);
}

/** Routes an application command to its subcommand; anything unknown gets a polite ephemeral reply. */
export async function handleCommand(interaction: Interaction): Promise<InteractionResponse> {
  if (interaction.data?.name !== 'tgh') return notice('Unknown command.');
  const sub = interaction.data.options?.[0];
  const option = (name: string) => sub?.options?.find((o) => o.name === name)?.value?.trim() || undefined;
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  switch (sub?.name) {
    case 'profile':
      return profileCommand(option('player'), discordId);
    case 'clan':
      return clanCommand(option('tag') ?? '');
    case 'lfg':
      return lfgCommand(option('game'));
    case 'top':
      return topCommand();
    case 'link':
      return linkCommand(discordId);
    default:
      return notice('Unknown command.');
  }
}
