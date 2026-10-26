import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { IgdbGame } from '../igdb/igdb.mapper';
import { accentFrom, igdbUpdate, monogramFor, taglineFrom } from './games.igdb';

const igdbData: IgdbGame = {
  igdbId: 242408,
  name: 'Counter-Strike 2',
  slug: 'counter-strike-2',
  url: 'https://www.igdb.com/games/counter-strike-2',
  summary: 'IGDB summary.',
  releaseDate: new Date('2023-09-27T00:00:00Z'),
  developer: 'Valve',
  publisher: '',
  genres: ['action'],
  platforms: [],
  modes: ['multiplayer'],
  languages: ['English'],
  links: { official: null, store: 'https://store.steampowered.com/app/730' },
  steamAppId: 730,
  freeToPlay: true,
  coverId: 'coaczd',
  artworkIds: ['ar4kon'],
  screenshotIds: ['scoqi3'],
  videoIds: ['s6BNHro0vSg'],
  rating: 68,
  ratingCount: 367,
  altNames: ['cs2'],
};

const catalogueGame = {
  genres: ['fps' as const],
  platforms: ['pc' as const],
  description: 'Our own description.',
  releaseDate: null,
  developer: 'Old developer',
  publisher: 'Valve Corporation',
  languages: [],
  links: { official: 'https://www.counter-strike.net', store: null },
  steamAppId: null,
};

describe('IGDB sync rules', () => {
  test('IGDB facts replace the catalogue’s, blanks keep what we had', () => {
    const update = igdbUpdate(catalogueGame, igdbData, new Date('2026-10-25T00:00:00Z'));
    assert.equal(update.description, 'IGDB summary.');
    assert.equal(update.developer, 'Valve');
    assert.equal(update.publisher, 'Valve Corporation', 'IGDB had none');
    assert.deepEqual(update.platforms, ['pc'], 'IGDB had none');
    assert.deepEqual(update.modes, ['multiplayer']);
    assert.equal(update['links.official'], 'https://www.counter-strike.net');
    assert.equal(update['links.store'], 'https://store.steampowered.com/app/730');
    assert.equal(update.steamAppId, 730);
    assert.equal(update['igdb.coverId'], 'coaczd');
    assert.equal(update['igdb.syncedAt']?.toISOString(), '2026-10-25T00:00:00.000Z');
  });

  test('hand-picked genres win; IGDB only fills an empty list', () => {
    assert.deepEqual(igdbUpdate(catalogueGame, igdbData, new Date()).genres, ['fps']);
    assert.deepEqual(igdbUpdate({ ...catalogueGame, genres: [] }, igdbData, new Date()).genres, ['action']);
  });
});

describe('imported game identity', () => {
  test('monograms from titles', () => {
    assert.equal(monogramFor('Counter-Strike 2'), 'CS2');
    assert.equal(monogramFor('Minecraft'), 'MIN');
    assert.equal(monogramFor('League of Legends'), 'LOL');
    assert.equal(monogramFor('Cyberpunk 2077'), 'CY');
    assert.equal(monogramFor('Grand Theft Auto V'), 'GTAV');
    assert.equal(monogramFor('!!!'), 'G');
  });

  test('accent colours stay readable under white text', () => {
    const lightness = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return (Math.max(r!, g!, b!) + Math.min(r!, g!, b!)) / 2;
    };
    for (const colour of [{ r: 250, g: 240, b: 60 }, { r: 10, g: 10, b: 30 }, { r: 200, g: 30, b: 30 }, { r: 128, g: 128, b: 128 }]) {
      const accent = accentFrom(colour);
      assert.match(accent, /^#[0-9a-f]{6}$/);
      assert.ok(lightness(accent) <= 0.49 && lightness(accent) >= 0.29, `${accent} lightness ${lightness(accent)}`);
    }
  });

  test('taglines are the first sentence, cut at a word', () => {
    assert.equal(taglineFrom('Fast arena shooter. Second sentence here.'), 'Fast arena shooter.');
    const long = taglineFrom(`${'word '.repeat(40)}end.`);
    assert.ok(long.length <= 140 && long.endsWith('…'));
  });
});
