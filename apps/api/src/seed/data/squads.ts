import type { CLAN_COLORS, ClanJoinPolicy, CountryCode, LfgLanguage, LfgPostInput, Platform } from '@tgh/shared';

/** Demo clans, built from the demo players (usernames from content.ts). */
export const CLANS: Array<{
  tag: string;
  name: string;
  color: (typeof CLAN_COLORS)[number];
  joinPolicy: ClanJoinPolicy;
  country: CountryCode;
  games: string[];
  description: string;
  owner: string;
  officers: string[];
  members: string[];
  /** Applications left waiting so the leader has something to review. */
  pending: string[];
}> = [
  {
    tag: 'CRTG',
    name: 'Carthage Wolves',
    color: '#e10600',
    joinPolicy: 'request',
    country: 'TN',
    games: ['counter-strike-2', 'valorant'],
    description: 'Tunis-based CS2 and Valorant team. Scrims Tuesday and Thursday at 21:00, chill deathmatch every night. Mic and good vibes required.',
    owner: 'kaiser.tn',
    officers: ['carthage_kid'],
    members: ['medina_mage', 'gabes_ghost'],
    pending: ['ariana_ace'],
  },
  {
    tag: 'SFX',
    name: 'Sfax Snipers',
    color: '#0a96e8',
    joinPolicy: 'open',
    country: 'TN',
    games: ['pubg-mobile', 'call-of-duty-warzone'],
    description: 'Battle royale crew from the south. Open doors — drop in, play, have fun.',
    owner: 'sfaxsniper',
    officers: [],
    members: ['sousse_striker', 'kairouan_king', 'nabeul_nova'],
    pending: [],
  },
  {
    tag: 'ISLE',
    name: 'Djerba Drift',
    color: '#0f8b8d',
    joinPolicy: 'request',
    country: 'TN',
    games: ['rocket-league', 'ea-sports-fc-25'],
    description: 'Rocket League and FC 25 on PS5 and PC. Ranked grind on weekends.',
    owner: 'bizerte_breeze',
    officers: [],
    members: ['djerba_drift', 'monastir_mvp'],
    pending: [],
  },
  {
    tag: 'DIAS',
    name: 'Diaspora Esports',
    color: '#7c4dff',
    joinPolicy: 'closed',
    country: 'FR',
    games: ['league-of-legends'],
    description: 'Tunisians abroad — EUW League of Legends. Not recruiting right now; tryouts are announced here.',
    owner: 'lyon_lynx',
    officers: [],
    members: [],
    pending: [],
  },
];

type LfgSeed = Omit<LfgPostInput, 'gameId' | 'platform' | 'languages'> & {
  author: string;
  game: string;
  platform: Platform;
  languages: LfgLanguage[];
  accepted?: string[];
  pending?: string[];
};

export const LFG_POSTS: LfgSeed[] = [
  {
    author: 'carthage_kid',
    game: 'valorant',
    platform: 'pc',
    mode: 'Ranked duo',
    rank: 'Diamond 1',
    slots: 1,
    languages: ['ar', 'fr'],
    micRequired: true,
    note: 'Duelist main looking for a controller or sentinel. Evenings after 21:00.',
    contact: 'Discord: carthage_kid',
    durationHours: 24,
    pending: ['gabes_ghost'],
  },
  {
    author: 'nabeul_nova',
    game: 'marvel-rivals',
    platform: 'pc',
    mode: 'Competitive 6-stack',
    rank: 'Platinum',
    slots: 4,
    languages: ['ar', 'fr'],
    micRequired: true,
    note: 'Strategist main. Need a tank, two DPS and a support for a regular stack.',
    contact: 'Discord: nova.heals',
    durationHours: 6,
    accepted: ['djerba_drift'],
  },
  {
    author: 'sousse_striker',
    game: 'efootball',
    platform: 'playstation',
    mode: 'Friday friendlies',
    rank: '',
    slots: 3,
    languages: ['ar'],
    micRequired: false,
    note: 'Weekly eFootball friendlies — Friday night lobby, all levels welcome.',
    contact: 'PSN: sousse_striker',
    durationHours: 72,
  },
  {
    author: 'monastir_mvp',
    game: 'tekken-8',
    platform: 'pc',
    mode: 'Sparring',
    rank: 'Fujin',
    slots: 2,
    languages: ['ar', 'fr', 'en'],
    micRequired: true,
    note: 'Looking for sparring partners to lab punishes. First-to-5 sets.',
    contact: 'Discord: monastir_mvp',
    durationHours: 24,
  },
  {
    author: 'lyon_lynx',
    game: 'league-of-legends',
    platform: 'pc',
    mode: 'Flex queue',
    rank: 'Gold',
    slots: 2,
    languages: ['fr', 'en'],
    micRequired: true,
    note: 'EUW. Jungle main, looking for a mid and a support for flex.',
    contact: 'Riot ID: LyonLynx#EUW',
    durationHours: 24,
  },
];
