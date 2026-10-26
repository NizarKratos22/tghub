import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFreeSearch, parseFreeUntil } from './steam-free.adapter';

// Trimmed from the store's search results (maxprice=free&specials=1).
const row = (appId: string, title: string, discount: string) => `
  <a href="https://store.steampowered.com/app/${appId}/Some_Game/?snr=1_7_7_2300_150_1"
     data-ds-appid="${appId}" data-ds-itemkey="App_${appId}" onmouseover="GameHover( this, event, 'global_hover', {&quot;type&quot;:&quot;app&quot;,&quot;id&quot;:${appId}} );" class="search_result_row ds_collapse_flag ">
    <div class="search_capsule"><img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_231x87.jpg" ></div>
    <div class="responsive_search_name_combined">
      <div class="search_name ellipsis"><span class="title">${title}</span></div>
      <div class="search_price_discount_combined responsive_secondrow" data-price-final="0">
        <div class="discount_block search_discount_block" data-price-final="0" data-bundlediscount="0" data-discount="${discount}"><div class="discount_pct">-${discount}%</div></div>
      </div>
    </div>
  </a>`;

describe('parseFreeSearch', () => {
  it('reads app id and title of 100%-off rows', () => {
    const html = row('5340370', 'Popcorn &amp; Premieren', '100') + row('4841320', 'Squad Recon Pack', '100');
    assert.deepEqual(parseFreeSearch(html), [
      { appId: 5340370, title: 'Popcorn & Premieren' },
      { appId: 4841320, title: 'Squad Recon Pack' },
    ]);
  });

  it('skips rows that are not fully free and bundles with several apps', () => {
    const bundle = row('10,20,30', 'Big Bundle', '100');
    assert.deepEqual(parseFreeSearch(row('111', 'Half price', '50') + bundle), []);
  });
});

describe('parseFreeUntil', () => {
  const now = new Date('2026-10-25T12:00:00Z');

  it('reads "29 Oct @ 5:00pm" as UTC this year', () => {
    const page = '<p class="game_purchase_discount_quantity ">Free to keep when you get it before 29 Oct @ 5:00pm. Some limitations apply.';
    assert.equal(parseFreeUntil(page, now)?.toISOString(), '2026-10-29T17:00:00.000Z');
  });

  it('reads the US order, morning hours and 12am', () => {
    assert.equal(parseFreeUntil('Free to keep when you get it before Nov 2 @ 10:00am.', now)?.toISOString(), '2026-11-02T10:00:00.000Z');
    assert.equal(parseFreeUntil('Free to keep when you get it before Nov 2 @ 12:30am.', now)?.toISOString(), '2026-11-02T00:30:00.000Z');
  });

  it('rolls an early-January date into next year', () => {
    const late = new Date('2026-12-28T12:00:00Z');
    assert.equal(parseFreeUntil('Free to keep when you get it before 3 Jan @ 6:00pm.', late)?.toISOString(), '2027-01-03T18:00:00.000Z');
  });

  it('uses a year when the page prints one', () => {
    assert.equal(parseFreeUntil('Free to keep when you get it before 3 Jan, 2027 @ 6:00pm.', now)?.toISOString(), '2027-01-03T18:00:00.000Z');
  });

  it('returns null when the page has no end time', () => {
    assert.equal(parseFreeUntil('<p>Free to Play</p>', now), null);
    assert.equal(parseFreeUntil('Free to keep when you get it before 40 Foo @ 5:00pm.', now), null);
  });
});
