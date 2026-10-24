import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listingInputSchema, marketListQuerySchema } from './schemas/market';

const PHOTO = 'a'.repeat(24);

const physical = {
  title: 'RTX 3060 12GB',
  description: 'Used for a year, never mined on, original box.',
  category: 'pc-parts',
  subcategory: 'gpu',
  price: 950,
  condition: 'good',
  region: 'Sfax',
  meetup: true,
  photoIds: [PHOTO],
};

const fivem = {
  title: 'Advanced garage script',
  description: 'Multi-garage system with impound and job vehicles.',
  category: 'fivem',
  subcategory: 'scripts',
  price: 120,
  digital: { framework: 'qbcore', delivery: 'keymaster', source: 'escrow', rightsConfirmed: true },
  photoIds: [PHOTO],
};

function fieldErrors(input: unknown): string[] {
  const result = listingInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('listing input', () => {
  it('accepts a complete physical listing', () => {
    assert.deepEqual(fieldErrors(physical), []);
  });

  it('asks physical listings for condition, location and a way to hand over', () => {
    const errors = fieldErrors({ ...physical, condition: null, region: null, meetup: false, shipping: false });
    assert.deepEqual(errors.sort(), ['condition', 'meetup', 'region']);
  });

  it('accepts a FiveM asset without condition or location', () => {
    assert.deepEqual(fieldErrors(fivem), []);
  });

  it('requires a framework for FiveM assets', () => {
    assert.deepEqual(fieldErrors({ ...fivem, digital: { ...fivem.digital, framework: null } }), ['digital.framework']);
  });

  it('requires the seller to vouch for the rights to a digital asset', () => {
    assert.deepEqual(fieldErrors({ ...fivem, digital: { ...fivem.digital, rightsConfirmed: false } }), ['digital.rightsConfirmed']);
  });

  it('rejects a subcategory from another category', () => {
    assert.deepEqual(fieldErrors({ ...physical, subcategory: 'scripts' }), ['subcategory']);
  });

  it('rejects fractional prices and the same photo twice', () => {
    assert.deepEqual(fieldErrors({ ...physical, price: 9.5, photoIds: [PHOTO, PHOTO] }).sort(), ['photoIds', 'price']);
  });
});

describe('marketplace query', () => {
  it('treats blank filters as no filter', () => {
    const query = marketListQuerySchema.parse({ q: '', minPrice: '', shipping: '' });
    assert.equal(query.q, undefined);
    assert.equal(query.minPrice, undefined);
    assert.equal(query.shipping, undefined);
    assert.equal(query.sort, 'newest');
  });

  it('coerces price bounds from the query string', () => {
    const query = marketListQuerySchema.parse({ minPrice: '100', maxPrice: '900', shipping: 'true' });
    assert.equal(query.minPrice, 100);
    assert.equal(query.maxPrice, 900);
    assert.equal(query.shipping, true);
  });
});
