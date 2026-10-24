import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fingerprintOf, normalizeMessage } from './error-log';

describe('error grouping', () => {
  it('groups occurrences that differ only by ids, numbers and values', () => {
    assert.equal(normalizeMessage('Listing 6adc77f461b4b5a911c959b0 not found after 3 tries'), 'Listing <id> not found after <n> tries');
    assert.equal(normalizeMessage("Cannot read 'title' of undefined"), 'Cannot read <value> of undefined');
    const stackA = 'TypeError: x\n    at render (C:/app/src/Card.tsx:12:5)\n    at node_modules/react/index.js:1:1';
    const stackB = 'TypeError: x\n    at render (C:/app/src/Card.tsx:14:9)';
    assert.equal(fingerprintOf('web', 'TypeError', 'Listing 1 failed', stackA), fingerprintOf('web', 'TypeError', 'Listing 2 failed', stackB));
  });

  it('keeps different bugs and different sources apart', () => {
    assert.notEqual(fingerprintOf('web', 'TypeError', 'a is undefined'), fingerprintOf('web', 'TypeError', 'b is undefined'));
    assert.notEqual(fingerprintOf('api', 'Error', 'boom'), fingerprintOf('web', 'Error', 'boom'));
  });
});
