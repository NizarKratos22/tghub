import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { codeMatches, generateCode, hashCode, maskEmail } from './codes';

const USER = 'a'.repeat(24);

describe('one-time codes', () => {
  it('generates six digits, keeping leading zeros', () => {
    for (let i = 0; i < 200; i += 1) assert.match(generateCode(), /^\d{6}$/);
  });

  it('matches only the right code for the right account', () => {
    const stored = hashCode('signup', USER, '042917');
    assert.equal(codeMatches('signup', USER, '042917', stored), true);
    assert.equal(codeMatches('signup', USER, '042918', stored), false);
    assert.equal(codeMatches('signup', 'b'.repeat(24), '042917', stored), false);
  });

  it('binds a code to its purpose', () => {
    const stored = hashCode('signup', USER, '111222');
    assert.equal(codeMatches('password_reset', USER, '111222', stored), false);
  });

  it('never stores the code itself', () => {
    assert.ok(!hashCode('signup', USER, '123456').includes('123456'));
  });

  it('masks the address but keeps it recognisable', () => {
    assert.equal(maskEmail('krat0s@gmail.com'), 'kr••••@gmail.com');
    assert.equal(maskEmail('ab@x.tn'), 'a•••@x.tn');
  });
});
