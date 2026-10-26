import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { igdbImage, mapGenres, mapModes, mapPlatforms, parseIgdbGame } from './igdb.mapper';

/** Trimmed from IGDB's real response for Counter-Strike 2 (id 242408). */
const CS2 = {
  id: 242408,
  name: 'Counter-Strike 2',
  slug: 'counter-strike-2',
  url: 'https://www.igdb.com/games/counter-strike-2',
  summary: 'Counter-Strike 2 is a free-to-play multiplayer tactical  first-person shooter\ndeveloped by Valve.',
  first_release_date: 1695772800,
  game_type: 0,
  cover: { id: 483385, image_id: 'coaczd' },
  artworks: [{ id: 1, image_id: 'ar4kon' }],
  screenshots: [{ id: 2, image_id: 'scoqi3' }, { id: 3, image_id: 'scoqi4' }],
  videos: [{ id: 4, video_id: 's6BNHro0vSg' }, { id: 5, video_id: 'bad id!' }],
  genres: [{ id: 5, slug: 'shooter' }, { id: 24, slug: 'tactical' }],
  themes: [{ id: 1, slug: 'action' }, { id: 39, slug: 'warfare' }],
  game_modes: [{ id: 1, slug: 'single-player' }, { id: 2, slug: 'multiplayer' }],
  player_perspectives: [{ id: 1, slug: 'first-person' }],
  platforms: [3, 6],
  involved_companies: [{ id: 6, company: { id: 56, name: 'Valve' }, developer: true, publisher: true }],
  websites: [
    { id: 7, url: 'https://www.reddit.com/r/counterstrike/', type: 14 },
    { id: 8, url: 'https://www.counter-strike.net/cs2', type: 1 },
    { id: 9, url: 'https://store.steampowered.com/app/730', type: 13 },
  ],
  total_rating: 68.0655,
  total_rating_count: 367,
  alternative_names: [{ id: 10, name: 'CS2' }, { id: 11, name: 'Counter Strike 2' }, { id: 12, name: '反恐精英：全球攻势' }, { id: 13, name: 'cs2.exe' }, { id: 14, name: 'Counter-Strike 2' }],
  language_supports: [{ language: { name: 'English' } }, { language: { name: 'German' } }, { language: { name: 'Arabic' } }, { language: { name: 'French' } }, { language: { name: 'English' } }],
  keywords: [{ id: 15, slug: 'competitive' }],
  external_games: [{ uid: '730', external_game_source: 1 }, { uid: 'abc', external_game_source: 5 }],
};

describe('IGDB mapper', () => {
  test('maps a full game into catalogue terms', () => {
    const game = parseIgdbGame(CS2);
    assert.ok(game);
    assert.equal(game.igdbId, 242408);
    assert.equal(game.name, 'Counter-Strike 2');
    assert.equal(game.summary, 'Counter-Strike 2 is a free-to-play multiplayer tactical first-person shooter developed by Valve.');
    assert.equal(game.releaseDate?.toISOString(), '2023-09-27T00:00:00.000Z');
    assert.equal(game.developer, 'Valve');
    assert.equal(game.publisher, 'Valve');
    assert.deepEqual(game.genres, ['fps']);
    assert.deepEqual(game.platforms, ['pc']);
    assert.deepEqual(game.modes, ['single-player', 'multiplayer']);
    assert.deepEqual(game.links, { official: 'https://www.counter-strike.net/cs2', store: 'https://store.steampowered.com/app/730' });
    assert.equal(game.steamAppId, 730);
    assert.equal(game.coverId, 'coaczd');
    assert.deepEqual(game.artworkIds, ['ar4kon']);
    assert.deepEqual(game.screenshotIds, ['scoqi3', 'scoqi4']);
    assert.deepEqual(game.videoIds, ['s6BNHro0vSg']);
    assert.equal(game.rating, 68);
    assert.equal(game.ratingCount, 367);
  });

  test('keeps searchable alternative names only', () => {
    assert.deepEqual(parseIgdbGame(CS2)?.altNames, ['cs2', 'counter strike 2']);
  });

  test('lists Arabic, French and English first, without duplicates', () => {
    assert.deepEqual(parseIgdbGame(CS2)?.languages, ['Arabic', 'French', 'English', 'German']);
  });

  test('treats the free-to-play keyword as free to play', () => {
    assert.equal(parseIgdbGame(CS2)?.freeToPlay, false);
    assert.equal(parseIgdbGame({ ...CS2, keywords: [{ slug: 'free-to-play' }] })?.freeToPlay, true);
  });

  test('hides the rating until enough players have rated', () => {
    assert.equal(parseIgdbGame({ ...CS2, total_rating_count: 3 })?.rating, null);
  });

  test('maps genres without over-labelling', () => {
    assert.deepEqual(mapGenres({ genres: [{ slug: 'moba' }], themes: [{ slug: 'action' }], game_modes: [], player_perspectives: [] }), ['moba']);
    assert.deepEqual(
      mapGenres({ genres: [{ slug: 'shooter' }], themes: [], game_modes: [{ slug: 'battle-royale' }], player_perspectives: [{ slug: 'third-person' }] }),
      ['battle-royale'],
    );
    assert.deepEqual(mapGenres({ genres: [{ slug: 'tactical' }], themes: [], game_modes: [], player_perspectives: [] }), [], 'tactical is not strategy');
    assert.deepEqual(mapGenres({ genres: [{ slug: 'adventure' }], themes: [{ slug: 'sandbox' }], game_modes: [], player_perspectives: [] }), ['sandbox']);
    assert.deepEqual(mapGenres({ genres: [{ slug: 'adventure' }], themes: [], game_modes: [], player_perspectives: [] }), ['action']);
  });

  test('maps platform ids and modes', () => {
    assert.deepEqual(mapPlatforms([167, 169, 6, 34, 508]), ['pc', 'playstation', 'xbox', 'switch', 'mobile']);
    assert.deepEqual(mapPlatforms([999]), []);
    assert.deepEqual(mapModes([{ slug: 'co-operative' }, { slug: 'massively-multiplayer-online-mmo' }, { slug: 'unknown' }]), ['co-op', 'mmo']);
  });

  test('rejects responses it cannot read', () => {
    assert.equal(parseIgdbGame({ id: 'x' }), null);
    assert.equal(parseIgdbGame(null), null);
  });

  test('builds WebP image URLs', () => {
    assert.equal(igdbImage('coaczd', 'cover_big_2x'), 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaczd.webp');
  });
});
