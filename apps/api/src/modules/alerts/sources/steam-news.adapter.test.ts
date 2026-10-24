import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanSteamContents } from './steam-news.adapter';

describe('cleanSteamContents', () => {
  it('turns paragraphs into spaced sentences', () => {
    assert.equal(cleanSteamContents('[p]Greetings, Rivals![/p][p]Patch is live.[/p]'), 'Greetings, Rivals! Patch is live.');
  });

  it('drops images, embeds and tags with attributes', () => {
    const raw = '[p align="justify"]Hello[/p][img src="{STEAM_CLAN_IMAGE}/1/a.png"][/img][previewyoutube="abc;full"][/previewyoutube][h2]Changes[/h2]';
    assert.equal(cleanSteamContents(raw), 'Hello Changes');
  });

  it('keeps escaped brackets as literal text', () => {
    assert.equal(cleanSteamContents('[p]\\[ MAP SCRIPTING \\] Added Instance.Precache[/p]'), '[ MAP SCRIPTING ] Added Instance.Precache');
  });

  it('truncates long notes on a word boundary', () => {
    const summary = cleanSteamContents(`[p]${'word '.repeat(200)}[/p]`);
    assert.ok(summary.length <= 261);
    assert.ok(summary.endsWith('…'));
    assert.ok(!summary.includes('wor…'));
  });
});
