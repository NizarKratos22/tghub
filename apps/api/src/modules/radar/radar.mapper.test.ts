import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Types } from 'mongoose';
import { imageFor } from './radar.mapper';

describe('imageFor', () => {
  const gameId = new Types.ObjectId();
  const art = new Map([[String(gameId), ['art1', 'shot1', 'shot2']]]);

  it('prefers the picture the source gave', () => {
    const doc = { _id: new Types.ObjectId(), imageUrl: 'https://cdn.example.com/a.png', gameId };
    assert.deepEqual(imageFor(doc, art), { url: 'https://cdn.example.com/a.png', wideUrl: 'https://cdn.example.com/a.png', fromGame: false });
  });

  it("falls back to one of the game's shots, the same one every time", () => {
    const doc = { _id: new Types.ObjectId(), imageUrl: null, gameId };
    const image = imageFor(doc, art);
    assert.ok(image?.fromGame);
    assert.match(image!.url, /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_screenshot_big\/(art1|shot1|shot2)\.webp$/);
    assert.equal(image!.wideUrl, image!.url.replace('t_screenshot_big', 't_1080p'));
    assert.deepEqual(imageFor(doc, art), image);
  });

  it('has nothing for stories without a picture or a game with art', () => {
    assert.equal(imageFor({ _id: new Types.ObjectId(), imageUrl: null, gameId: null }, art), null);
    assert.equal(imageFor({ _id: new Types.ObjectId(), imageUrl: null, gameId: new Types.ObjectId() }, art), null);
  });
});
