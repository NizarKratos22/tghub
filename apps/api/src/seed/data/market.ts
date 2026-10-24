import type { ListingInput, ListingStatus } from '@tgh/shared';
import type { ArtKind } from './market-art';

type Palette = readonly [string, string, string];

const BLUE: Palette = ['#0a96e8', '#063d6b', '#5cc4ff'];
const ORANGE: Palette = ['#ff7a45', '#7a1f0a', '#ffd166'];
const PURPLE: Palette = ['#7c3aed', '#1e0b46', '#c084fc'];
const GREEN: Palette = ['#01b876', '#04402b', '#7cf5c4'];
const RED: Palette = ['#ef4444', '#5c0d0d', '#fca5a5'];
const SLATE: Palette = ['#475569', '#0f172a', '#38bdf8'];
const GOLD: Palette = ['#f59e0b', '#5b3402', '#fde68a'];

export interface ListingSeed {
  /** PLAYERS index of the seller. */
  seller: number;
  input: Omit<ListingInput, 'photoIds' | 'negotiable' | 'openToTrades' | 'area' | 'meetup' | 'shipping' | 'region' | 'condition' | 'digital'> &
    Partial<Pick<ListingInput, 'negotiable' | 'openToTrades' | 'area' | 'meetup' | 'shipping' | 'region' | 'condition' | 'digital'>>;
  art: { kind: ArtKind; palette: Palette; photos: number };
  status?: ListingStatus;
  /** How long ago it was listed. */
  daysAgo: number;
  views: number;
}

const rights = { rightsConfirmed: true as const };

export const LISTINGS: ListingSeed[] = [
  /* ── FiveM & RP assets ── */
  {
    seller: 2,
    input: {
      title: 'Advanced garage & impound system',
      description:
        'Multi-garage system with public, job and gang garages, an impound lot with fees, and vehicle transfers between players.\n\nOptimised: 0.00ms idle, 0.02ms in use. Config for every location and price. Includes 6 months of updates and support on Discord.',
      category: 'fivem',
      subcategory: 'scripts',
      price: 120,
      negotiable: false,
      digital: { framework: 'qbcore', delivery: 'keymaster', source: 'escrow', ...rights },
    },
    art: { kind: 'code', palette: BLUE, photos: 2 },
    daysAgo: 1,
    views: 86,
  },
  {
    seller: 0,
    input: {
      title: 'Medina souk MLO — 14 shop interiors',
      description:
        'Hand-built souk with 14 enterable shops, rooftops and a café. Occlusion and timecycles done properly — no flickering, no texture loss.\n\nSold as a Keymaster transfer. Screens of every interior on request.',
      category: 'fivem',
      subcategory: 'mlo',
      price: 260,
      negotiable: true,
      digital: { framework: 'standalone', delivery: 'keymaster', source: 'escrow', ...rights },
    },
    art: { kind: 'building', palette: ORANGE, photos: 3 },
    daysAgo: 2,
    views: 140,
  },
  {
    seller: 4,
    input: {
      title: 'Police vehicle pack — 12 cars, ELS ready',
      description: 'Twelve lore-friendly police vehicles with liveries, extras and ELS lighting. Optimised textures (under 16MB per car). Open source — tweak the handling as you like.',
      category: 'fivem',
      subcategory: 'vehicles',
      price: 180,
      digital: { framework: 'standalone', delivery: 'download', source: 'open', ...rights },
    },
    art: { kind: 'car', palette: SLATE, photos: 2 },
    daysAgo: 3,
    views: 64,
  },
  {
    seller: 7,
    input: {
      title: 'Streetwear EUP pack — 40 outfits',
      description: 'Forty streetwear outfits (hoodies, tracksuits, jerseys) for male and female freemode peds. Comes with the EUP menu config.',
      category: 'fivem',
      subcategory: 'clothing',
      price: 90,
      openToTrades: true,
      digital: { framework: 'standalone', delivery: 'download', source: 'open', ...rights },
    },
    art: { kind: 'shirt', palette: PURPLE, photos: 1 },
    daysAgo: 5,
    views: 37,
  },
  {
    seller: 2,
    input: {
      title: 'Neon HUD + speedometer (ox_lib)',
      description: 'Minimal HUD with health, armour, hunger, thirst and stress, plus an animated speedometer and fuel gauge. Built on ox_lib; colours and positions are configurable in-game.',
      category: 'fivem',
      subcategory: 'ui',
      price: 45,
      digital: { framework: 'ox', delivery: 'tebex', source: 'escrow', ...rights },
    },
    art: { kind: 'hud', palette: BLUE, photos: 1 },
    daysAgo: 4,
    views: 52,
  },
  {
    seller: 0,
    input: {
      title: 'Qbox starter server base — 80 resources',
      description:
        'A ready-to-run Qbox base: jobs, housing, inventory, phone, garages and an admin menu, all configured and tested together. Includes the database schema and a setup call to get you online.\n\nOpen source. You get everything that is mine to sell — paid third-party assets are not included.',
      category: 'fivem',
      subcategory: 'server-base',
      price: 650,
      negotiable: true,
      digital: { framework: 'qbox', delivery: 'download', source: 'open', ...rights },
    },
    art: { kind: 'server', palette: GREEN, photos: 2 },
    daysAgo: 6,
    views: 211,
  },
  {
    seller: 9,
    input: {
      title: '25 add-on peds — civilians & gangs',
      description: 'Twenty-five add-on peds with streamed textures, ready for a ped menu. Includes a gang pack of 8.',
      category: 'fivem',
      subcategory: 'peds',
      price: 60,
      digital: { framework: 'standalone', delivery: 'download', source: 'open', ...rights },
    },
    art: { kind: 'person', palette: RED, photos: 1 },
    daysAgo: 8,
    views: 19,
  },
  {
    seller: 4,
    input: {
      title: 'Developer for hire — custom FiveM scripts',
      description: 'ESX and QBCore scripting: custom jobs, UI, bug fixes and performance work. Price is per hour, paid in milestones. Portfolio and references in chat.',
      category: 'fivem',
      subcategory: 'services',
      price: 50,
      negotiable: true,
      digital: { framework: 'esx', delivery: 'other', source: 'open', ...rights },
    },
    art: { kind: 'wrench', palette: GOLD, photos: 1 },
    daysAgo: 0,
    views: 23,
  },
  {
    seller: 10,
    input: {
      title: 'Delivery job script (ESX) — open source',
      description: 'Courier job with routes across the map, tips based on time, and a company boss menu. Fully open source with comments.',
      category: 'fivem',
      subcategory: 'scripts',
      price: 70,
      digital: { framework: 'esx', delivery: 'download', source: 'open', ...rights },
    },
    art: { kind: 'code', palette: GREEN, photos: 1 },
    daysAgo: 9,
    views: 28,
  },

  /* ── Mods ── */
  {
    seller: 5,
    input: {
      title: 'Minecraft survival plugin bundle',
      description: 'Economy, land claims, crates and custom enchants for Paper 1.21 — configured for a 100-player survival server.',
      category: 'mods',
      subcategory: 'minecraft',
      price: 80,
      digital: { framework: null, delivery: 'download', source: 'open', ...rights },
    },
    art: { kind: 'cube', palette: BLUE, photos: 1 },
    daysAgo: 7,
    views: 33,
  },
  {
    seller: 8,
    input: {
      title: 'SA-MP / open.mp roleplay gamemode',
      description: 'Complete RP gamemode with factions, jobs, houses and vehicles. MySQL saving. Runs on open.mp out of the box.',
      category: 'mods',
      subcategory: 'samp',
      price: 300,
      negotiable: true,
      digital: { framework: null, delivery: 'download', source: 'open', ...rights },
    },
    art: { kind: 'code', palette: ORANGE, photos: 1 },
    daysAgo: 12,
    views: 44,
  },

  /* ── Hardware ── */
  {
    seller: 0,
    input: {
      title: 'Gaming PC — Ryzen 5 5600 / RTX 3060 12GB / 16GB',
      description:
        'Built in 2023, used for CS2 and Valorant. 240+ FPS in CS2 at 1080p.\n\n• Ryzen 5 5600 + Deepcool AK400\n• RTX 3060 12GB\n• 16GB DDR4 3200\n• 1TB NVMe\n• 650W 80+ Bronze\n\nCan test it in front of you in Tunis.',
      category: 'gaming-pcs',
      subcategory: 'desktop',
      price: 2650,
      negotiable: true,
      condition: 'like-new',
      region: 'Tunis',
      area: 'Lac 2',
      meetup: true,
      shipping: true,
    },
    art: { kind: 'tower', palette: PURPLE, photos: 3 },
    daysAgo: 1,
    views: 173,
  },
  {
    seller: 3,
    input: {
      title: 'ASUS TUF A15 — RTX 4060, 144Hz',
      description: 'Ryzen 7 7735HS, RTX 4060 8GB, 16GB RAM, 512GB SSD. Battery health 94%. Comes with the original charger and box.',
      category: 'gaming-pcs',
      subcategory: 'laptop',
      price: 3400,
      condition: 'good',
      region: 'Sousse',
      area: 'Sahloul',
      meetup: true,
      shipping: true,
    },
    art: { kind: 'laptop', palette: BLUE, photos: 2 },
    daysAgo: 3,
    views: 98,
  },
  {
    seller: 1,
    input: {
      title: 'RTX 3070 Ti Gigabyte Gaming OC',
      description: 'Never mined on. Repasted in March, temperatures under 70°C in games. Original box included.',
      category: 'pc-parts',
      subcategory: 'gpu',
      price: 1350,
      negotiable: true,
      condition: 'good',
      region: 'Sfax',
      meetup: true,
      shipping: true,
    },
    art: { kind: 'gpu', palette: SLATE, photos: 2 },
    daysAgo: 2,
    views: 154,
  },
  {
    seller: 4,
    input: {
      title: 'Ryzen 7 5800X3D (boxed)',
      description: 'The best AM4 gaming CPU. Upgrading to AM5. Boxed, no cooler included (it never came with one).',
      category: 'pc-parts',
      subcategory: 'cpu',
      price: 980,
      condition: 'like-new',
      region: 'Ariana',
      meetup: true,
    },
    art: { kind: 'cpu', palette: ORANGE, photos: 1 },
    daysAgo: 4,
    views: 76,
  },
  {
    seller: 11,
    input: {
      title: 'Corsair Vengeance RGB 32GB DDR4 3600',
      description: '2×16GB kit, CL18. Works at XMP on B550 and X570.',
      category: 'pc-parts',
      subcategory: 'ram',
      price: 280,
      condition: 'good',
      region: 'Ariana',
      meetup: true,
      shipping: true,
    },
    art: { kind: 'ram', palette: PURPLE, photos: 1 },
    daysAgo: 6,
    views: 31,
  },
  {
    seller: 7,
    input: {
      title: 'PS5 Slim + 2 DualSense + FC 25',
      description: 'Disc edition, bought in January. Two controllers (one white, one black) and FC 25 on disc. Warranty card included.',
      category: 'consoles',
      subcategory: 'playstation',
      price: 1850,
      condition: 'like-new',
      region: 'Nabeul',
      area: 'Hammamet',
      meetup: true,
    },
    art: { kind: 'controller', palette: BLUE, photos: 2 },
    daysAgo: 1,
    views: 201,
  },
  {
    seller: 6,
    input: {
      title: 'Nintendo Switch OLED — white',
      description: 'Screen protector since day one, no scratches. Dock, Joy-Cons and the original box.',
      category: 'consoles',
      subcategory: 'nintendo',
      price: 950,
      condition: 'good',
      region: 'Monastir',
      meetup: true,
      shipping: true,
    },
    art: { kind: 'handheld', palette: RED, photos: 2 },
    status: 'pending',
    daysAgo: 5,
    views: 88,
  },
  {
    seller: 0,
    input: {
      title: 'Steam Deck OLED 512GB',
      description: 'Used for travel only. Comes with the case and a 256GB microSD card full of nothing — wiped.',
      category: 'consoles',
      subcategory: 'handheld',
      price: 2100,
      condition: 'like-new',
      region: 'Tunis',
      meetup: true,
    },
    art: { kind: 'handheld', palette: SLATE, photos: 1 },
    daysAgo: 10,
    views: 120,
  },
  {
    seller: 9,
    input: {
      title: 'Xbox Series S 512GB',
      description: 'Works perfectly, one controller.',
      category: 'consoles',
      subcategory: 'xbox',
      price: 820,
      condition: 'good',
      region: 'Gabès',
      meetup: true,
    },
    art: { kind: 'controller', palette: GREEN, photos: 1 },
    status: 'sold',
    daysAgo: 14,
    views: 95,
  },
  {
    seller: 5,
    input: {
      title: 'Logitech G Pro X Superlight 2',
      description: 'Black, bought three months ago. Comes with the grip tape and the receiver extension.',
      category: 'peripherals',
      subcategory: 'mouse',
      price: 360,
      condition: 'like-new',
      region: 'Bizerte',
      meetup: true,
      shipping: true,
    },
    art: { kind: 'mouse', palette: BLUE, photos: 1 },
    daysAgo: 2,
    views: 47,
  },
  {
    seller: 4,
    input: {
      title: 'Keychron K8 Pro — brown switches',
      description: 'Hot-swappable, QMK/VIA. Includes the keycap puller and the USB-C cable.',
      category: 'peripherals',
      subcategory: 'keyboard',
      price: 290,
      openToTrades: true,
      condition: 'good',
      region: 'Ariana',
      meetup: true,
    },
    art: { kind: 'keyboard', palette: GREEN, photos: 1 },
    daysAgo: 7,
    views: 26,
  },
  {
    seller: 1,
    input: {
      title: 'HyperX Cloud II Wireless',
      description: 'Ear pads are worn but the mic and battery are perfect. Cheap because of the pads.',
      category: 'peripherals',
      subcategory: 'headset',
      price: 210,
      condition: 'fair',
      region: 'Sfax',
      meetup: true,
      shipping: true,
    },
    art: { kind: 'headset', palette: RED, photos: 1 },
    daysAgo: 11,
    views: 22,
  },
  {
    seller: 3,
    input: {
      title: 'AOC 27" 165Hz IPS monitor',
      description: '27G2SP, 1080p 165Hz. No dead pixels. Stand and DisplayPort cable included.',
      category: 'setup',
      subcategory: 'monitor',
      price: 620,
      condition: 'good',
      region: 'Sousse',
      meetup: true,
    },
    art: { kind: 'monitor', palette: PURPLE, photos: 1 },
    daysAgo: 3,
    views: 58,
  },
  {
    seller: 8,
    input: {
      title: 'Racing-style gaming chair',
      description: 'Reclines to 160°, armrests a bit loose. Pick up in Kairouan.',
      category: 'setup',
      subcategory: 'chair',
      price: 250,
      negotiable: true,
      condition: 'fair',
      region: 'Kairouan',
      meetup: true,
    },
    art: { kind: 'chair', palette: ORANGE, photos: 1 },
    daysAgo: 9,
    views: 15,
  },
  {
    seller: 2,
    input: {
      title: 'Elden Ring — PS5 disc',
      description: 'Finished it. Trade for any recent fighting game or sell.',
      category: 'games',
      subcategory: 'ps-games',
      price: 95,
      openToTrades: true,
      condition: 'good',
      region: 'Tunis',
      meetup: true,
    },
    art: { kind: 'disc', palette: GOLD, photos: 1 },
    daysAgo: 4,
    views: 34,
  },
  {
    seller: 10,
    input: {
      title: 'Old gaming PC for parts — no GPU',
      description: 'i5-6500, 8GB, 500W PSU and a mid-tower case. No graphics card. Boots fine.',
      category: 'gaming-pcs',
      subcategory: 'desktop',
      price: 400,
      negotiable: true,
      condition: 'for-parts',
      region: 'Medenine',
      area: 'Djerba',
      meetup: true,
    },
    art: { kind: 'tower', palette: SLATE, photos: 1 },
    daysAgo: 13,
    views: 18,
  },
];

/** Threads between demo players: [buyer index, listing index, messages (true = buyer)]. */
export const CONVERSATIONS: Array<{ buyer: number; listing: number; messages: Array<[boolean, string]> }> = [
  {
    buyer: 3,
    listing: 13,
    messages: [
      [true, 'Salam! Is the 3070 Ti still available?'],
      [false, 'Yes it is. I can do a test in Sfax this weekend.'],
      [true, 'Would you take 1250 if I come Saturday?'],
    ],
  },
  {
    buyer: 6,
    listing: 0,
    messages: [
      [true, 'Hi, does the garage script work with qb-vehiclekeys out of the box?'],
      [false, 'Yes, keys are handed over when you take a car out. There is a config option if you use another key script.'],
    ],
  },
  {
    buyer: 1,
    listing: 11,
    messages: [[true, 'Is this still available?']],
  },
];
