import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanSteamContents, eventImage, firstSteamImage, matchEventImage } from './steam-news.adapter';

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

describe('firstSteamImage', () => {
  it('resolves the clan image placeholder', () => {
    const raw = '[p]Hi[/p][img src="{STEAM_CLAN_IMAGE}/45066917/abc123.png"][/img][img src="https://example.com/b.png"][/img]';
    assert.equal(firstSteamImage(raw), 'https://clan.akamai.steamstatic.com/images/45066917/abc123.png');
  });

  it('reads the older [img]url[/img] form and HTML images', () => {
    assert.equal(firstSteamImage('[img]https://cdn.example.com/a.jpg[/img]'), 'https://cdn.example.com/a.jpg');
    assert.equal(firstSteamImage('<p>x</p><img alt="" src="https://cdn.example.com/b.jpg">'), 'https://cdn.example.com/b.jpg');
  });

  it('takes the first picture in the post, whatever its form', () => {
    assert.equal(firstSteamImage('<img src="https://a.example/1.jpg"> [img]https://a.example/2.jpg[/img]'), 'https://a.example/1.jpg');
  });

  it('skips anything that is not a plain https address', () => {
    assert.equal(firstSteamImage('[img]http://insecure.example/a.jpg[/img]'), null);
    assert.equal(firstSteamImage('[img src="javascript:alert(1)"][/img] [img]https://ok.example/c.jpg[/img]'), 'https://ok.example/c.jpg');
    assert.equal(firstSteamImage('[p]No pictures here[/p]'), null);
  });
});

describe('Steam event images', () => {
  const event = {
    event_name: 'Season 2.5 Patch Notes',
    clan_steamid: '103582791474588325',
    rtime32_start_time: 1_760_000_000,
    jsondata: JSON.stringify({ localized_capsule_image: ['c4f1e5.png', null] }),
    announcement_body: { headline: 'Season 2.5  Patch Notes', posttime: 1_760_000_100 },
  };

  it('builds the capsule address from the clan account id', () => {
    assert.deepEqual(eventImage(event), {
      title: 'season 2.5 patch notes',
      postedAt: 1_760_000_100_000,
      url: 'https://clan.akamai.steamstatic.com/images/45066917/c4f1e5.png',
    });
  });

  it('ignores events without a usable image', () => {
    assert.equal(eventImage({ ...event, jsondata: '{}' }), null);
    assert.equal(eventImage({ ...event, jsondata: 'not json' }), null);
    assert.equal(eventImage({ ...event, jsondata: JSON.stringify({ localized_capsule_image: ['../../x.png'] }) }), null);
    assert.equal(eventImage({ ...event, clan_steamid: '12' }), null);
  });

  it('matches a news item by title within a few days', () => {
    const images = [eventImage(event)!];
    assert.equal(
      matchEventImage({ title: 'Season 2.5 Patch Notes', publishedAt: new Date(1_760_000_000_000) }, images),
      'https://clan.akamai.steamstatic.com/images/45066917/c4f1e5.png',
    );
    assert.equal(matchEventImage({ title: 'Season 2.5 Patch Notes', publishedAt: new Date(1_761_000_000_000) }, images), null);
    assert.equal(matchEventImage({ title: 'Another post', publishedAt: new Date(1_760_000_000_000) }, images), null);
  });
});
