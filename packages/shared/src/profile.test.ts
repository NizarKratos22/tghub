import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discordUsernameSchema, updateProfileSchema } from './schemas/auth';

test('Discord usernames are cleaned up the way Discord shows them', () => {
  assert.equal(discordUsernameSchema.parse('  @Sami.TN_99 '), 'sami.tn_99');
  assert.equal(discordUsernameSchema.parse('ab'), 'ab');
});

test('anything Discord would not accept is refused', () => {
  for (const bad of ['a', 'x'.repeat(33), 'sami..tn', 'sami tn', 'sami#1234', 'سامي', '<script>']) {
    assert.equal(discordUsernameSchema.safeParse(bad).success, false, bad);
  }
});

test('an empty Discord username clears it, an absent one leaves it alone', () => {
  assert.equal(updateProfileSchema.parse({ discordUsername: '' }).discordUsername, null);
  assert.equal(updateProfileSchema.parse({ discordUsername: '   ' }).discordUsername, null);
  assert.equal(updateProfileSchema.parse({ discordUsername: null }).discordUsername, null);
  assert.equal('discordUsername' in updateProfileSchema.parse({ bio: 'hi' }), false);
});
