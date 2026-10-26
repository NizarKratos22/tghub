import type { GuideInput } from '@tgh/shared';

/** Overwolf's own clip recorder works with every game below. */
const OUTPLAYED = {
  name: 'Outplayed',
  url: 'https://www.overwolf.com/app/overwolf-outplayed',
  description: 'Records your best plays automatically (kills, wins) so you can review and share them without running a recorder.',
};

/**
 * Starter competitive guides. Stable advice only — settings that exist in each
 * game, the official roles or classes, and habits that hold across patches —
 * nothing that changes every season (map pools, exact numbers). Overwolf apps
 * were checked on Overwolf's app store on 2026-10-26.
 */
export const GUIDES: Array<{ slug: string } & GuideInput> = [
  {
    slug: 'valorant',
    published: true,
    intro: 'A 5v5 tactical shooter: one life per round, first team to 13 rounds wins. Precise aim wins duels, but agent utility and trading win rounds. Start with the settings below, then pick a role.',
    sections: [
      {
        title: 'Settings that matter',
        items: [
          { label: 'Mouse acceleration', text: 'Turn off “Enhance pointer precision” in Windows so the same hand movement always turns the same distance.' },
          { label: 'Raw Input Buffer', text: 'Turn it on in VALORANT’s mouse settings if your mouse polls at 1000 Hz or more.' },
          { label: 'NVIDIA Reflex', text: 'Set Reflex Low Latency to On + Boost if your graphics card supports it, to cut input delay.' },
          { label: 'Frame rate', text: 'Keep your frame rate stable and above your monitor’s refresh rate; lower graphics settings if it drops in fights.' },
          { label: 'Crosshair', text: 'Use a small, high-contrast crosshair (cyan or green) that stays visible on every map.' },
        ],
      },
      {
        title: 'Roles',
        items: [
          { label: 'Duelist', text: 'Takes the first fight and creates space for the team to enter a site.' },
          { label: 'Initiator', text: 'Gathers information and sets up fights with flashes and recon.' },
          { label: 'Controller', text: 'Blocks sightlines with smokes so the team can take or hold space.' },
          { label: 'Sentinel', text: 'Locks down a site and watches flanks with traps and utility.' },
        ],
      },
      {
        title: 'Habits that climb',
        items: [
          { label: 'Crosshair placement', text: 'Keep your crosshair at head height where enemies will appear, so you only make small adjustments.' },
          { label: 'Stop before you shoot', text: 'Moving makes shots inaccurate: tap the opposite direction to stop, then fire.' },
          { label: 'Trade your teammates', text: 'Play close enough to a teammate to kill whoever shoots them.' },
          { label: 'Call what you see', text: 'Short calls — how many, where, what utility — win more rounds than silent aim.' },
          { label: 'Warm up', text: 'Ten minutes in the Range or a Deathmatch before ranked.' },
        ],
      },
    ],
    overwolfApps: [
      {
        name: 'Valorant Tracker',
        url: 'https://www.overwolf.com/app/tracker_network-valorant_tracker',
        description: 'Tracker.gg’s overlay: teammates’ ranks and stats at agent select, live match stats and your season history.',
      },
      {
        name: 'Strats.gg Valorant App',
        url: 'https://overwolf.com/app/strats.gg-strats_app',
        description: 'Team strategies and lineups you can plan and pull up between rounds.',
      },
      OUTPLAYED,
    ],
    overwolfStoreUrl: 'https://www.overwolf.com/browse-by-game/valorant',
  },
  {
    slug: 'counter-strike-2',
    published: true,
    intro: 'Five against five, bomb attack and defence, first to 13 rounds in Premier. Aim matters, but movement, utility and money decisions decide most rounds.',
    sections: [
      {
        title: 'Settings that matter',
        items: [
          { label: 'Mouse acceleration', text: 'Turn off “Enhance pointer precision” in Windows for consistent aim.' },
          { label: 'NVIDIA Reflex', text: 'Enable NVIDIA Reflex Low Latency in the video settings if your graphics card supports it.' },
          { label: 'Boost Player Contrast', text: 'Turn it on so players stand out from the background.' },
          { label: 'Frame rate', text: 'Aim for a stable frame rate well above your refresh rate; it matters more than high graphics.' },
          { label: 'Crosshair', text: 'Build a small, static crosshair in the in-game editor or import one with a share code.' },
        ],
      },
      {
        title: 'Roles',
        items: [
          { label: 'Entry fragger', text: 'First into the site, taking the opening duel so the team can follow.' },
          { label: 'AWPer', text: 'Holds long angles with the AWP and picks the first kill.' },
          { label: 'Support', text: 'Throws flashes and smokes for teammates and trades the entry.' },
          { label: 'Lurker', text: 'Plays away from the team to catch rotations and flanks.' },
          { label: 'In-game leader', text: 'Calls the strategy, the economy and mid-round changes.' },
        ],
      },
      {
        title: 'Habits that climb',
        items: [
          { label: 'Counter-strafe', text: 'Tap the opposite movement key to stop instantly before shooting.' },
          { label: 'Learn a few lineups', text: 'One smoke, one flash and one molotov per site on your main maps beats knowing none.' },
          { label: 'Buy as a team', text: 'Full-buy together or save together; half-buys lose rounds and money.' },
          { label: 'Trade', text: 'Stay close enough to the entry to swing on whoever kills them.' },
          { label: 'Watch your demos', text: 'Re-watch rounds you lost from your own view; positioning mistakes show up fast.' },
        ],
      },
    ],
    overwolfApps: [
      {
        name: 'Counter-Strike 2 Tracker',
        url: 'https://overwolf.com/app/tracker_network-counter-strike_2_tracker',
        description: 'Tracker Network’s overlay with players’ FACEIT levels, a live scoreboard and match history.',
      },
      {
        name: 'CS2 Tactics',
        url: 'https://www.overwolf.com/app/shoast-cs2_tactics',
        description: 'A strategy whiteboard and playbook to plan executes with your team.',
      },
      OUTPLAYED,
    ],
    overwolfStoreUrl: 'https://www.overwolf.com/browse-by-game/counter-strike-2',
  },
  {
    slug: 'league-of-legends',
    published: true,
    intro: 'A 5v5 MOBA on Summoner’s Rift: farm, win your lane, take objectives and destroy the enemy Nexus. Climbing comes from mastering a few champions in one role.',
    sections: [
      {
        title: 'Settings that matter',
        items: [
          { label: 'Quick cast', text: 'Use quick cast with indicator: abilities fire on key release, showing the range while you hold the key.' },
          { label: 'Camera', text: 'Unlock the camera once you’re comfortable and recentre with the space bar to watch the whole map.' },
          { label: 'Attack move', text: 'Bind attack move so clicks target the nearest enemy instead of walking past them.' },
          { label: 'Frame rate', text: 'Cap the frame rate at or above your monitor’s refresh rate for smooth last-hits.' },
        ],
      },
      {
        title: 'Roles',
        items: [
          { label: 'Top', text: 'Duels on the long top lane; often a tank or bruiser who splits or holds the side lane.' },
          { label: 'Jungle', text: 'Farms the jungle camps, ganks lanes and secures dragons and Baron.' },
          { label: 'Mid', text: 'The central lane: roams to help both sides and often carries with damage.' },
          { label: 'Bot (ADC)', text: 'Ranged damage that scales with items and must stay safe in fights.' },
          { label: 'Support', text: 'Protects the ADC, places vision and starts or stops fights.' },
        ],
      },
      {
        title: 'Habits that climb',
        items: [
          { label: 'Few champions', text: 'Play two or three champions in one role until you know their matchups.' },
          { label: 'Last-hit', text: 'Minion gold is your main income; practise last-hitting in a custom game.' },
          { label: 'Track the jungler', text: 'Note where the enemy jungler was last seen and play safe on the side they’re heading to.' },
          { label: 'Vision', text: 'Buy a Control Ward on every recall and ward the river before objectives.' },
          { label: 'Mute and focus', text: 'Chat arguments lose games; mute early and play your role.' },
        ],
      },
    ],
    overwolfApps: [
      {
        name: 'Porofessor.gg',
        url: 'https://www.overwolf.com/app/trebonius-porofessor.gg',
        description: 'Scouts both teams at champion select, then shows jungle timers, gold difference and matchup win rates in game.',
      },
      OUTPLAYED,
    ],
    overwolfStoreUrl: 'https://www.overwolf.com/browse-by-game/league-of-legends',
  },
  {
    slug: 'apex-legends',
    published: true,
    intro: 'A squad battle royale: drop, loot, rotate with the ring and be the last squad standing. Positioning and team play beat chasing kills.',
    sections: [
      {
        title: 'Settings that matter',
        items: [
          { label: 'Field of view', text: 'Raise the FOV (around 100–110) to see more around you.' },
          { label: 'NVIDIA Reflex', text: 'Set NVIDIA Reflex to Enabled + Boost if your graphics card supports it.' },
          { label: 'Mouse acceleration', text: 'Turn off “Enhance pointer precision” in Windows.' },
          { label: 'Frame rate', text: 'Lower settings until the frame rate stays stable in late-game fights, when the most is happening.' },
        ],
      },
      {
        title: 'Legend classes',
        items: [
          { label: 'Assault', text: 'Front-line fighters who push fights and win close-range duels.' },
          { label: 'Skirmisher', text: 'Mobile legends who reposition fast to take or escape fights.' },
          { label: 'Recon', text: 'Scan for enemies and find the next ring to plan rotations.' },
          { label: 'Support', text: 'Keep the squad alive with heals, revives and supplies.' },
          { label: 'Controller', text: 'Lock down an area with traps and cover to hold strong positions.' },
        ],
      },
      {
        title: 'Habits that win',
        items: [
          { label: 'Land together', text: 'Drop with your squad: three players fighting together beat three fighting alone.' },
          { label: 'Ping everything', text: 'Enemies, loot and destinations; pings are the fastest way to talk.' },
          { label: 'Rotate early', text: 'Move to the next ring before it closes so you choose the position, not the storm.' },
          { label: 'Reload behind cover', text: 'Break line of sight before reloading or healing.' },
          { label: 'Pick third-party fights', text: 'Join a fight between two squads only when you can finish it quickly.' },
        ],
      },
    ],
    overwolfApps: [
      {
        name: 'Apex Legends Tracker',
        url: 'https://www.overwolf.com/app/tracker_network-apex_legends_tracker',
        description: 'Tracker Network’s overlay with kills and knockdowns for every squad and players’ rank scores before the match.',
      },
      OUTPLAYED,
    ],
    overwolfStoreUrl: 'https://www.overwolf.com/browse-by-game/apex-legends',
  },
];
