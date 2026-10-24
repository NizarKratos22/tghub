import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchCriteriaSchema, type SearchCriteria } from '@tgh/shared';
import { describeSearch } from './searches.service';

/** Parsed criteria always carry `q`; tests only spell out what matters. */
const c = (criteria: Partial<SearchCriteria>) => criteria as SearchCriteria;

describe('saved search names', () => {
  it('reads like the filters a player picked', () => {
    assert.equal(describeSearch(c({ q: 'rtx', category: 'pc-parts', maxPrice: 1500, region: 'Sfax' })), '“rtx” · PC parts · under 1,500 TND · Sfax');
    assert.equal(describeSearch(c({ category: 'fivem', framework: 'qbcore', minPrice: 50, maxPrice: 200 })), 'FiveM & RP assets · QBCore · 50 TND–200 TND');
    assert.equal(describeSearch(c({ category: 'consoles', sub: 'playstation' })), 'PlayStation');
  });

  it('never exceeds the 60-character name limit', () => {
    assert.ok(describeSearch(c({ q: 'x'.repeat(80) })).length <= 60);
  });

  it('refuses to save "everything"', () => {
    assert.equal(searchCriteriaSchema.safeParse({}).success, false);
    assert.equal(searchCriteriaSchema.safeParse({ q: 'gpu' }).success, true);
  });
});
