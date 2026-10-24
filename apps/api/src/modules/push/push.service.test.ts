import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pushTarget } from '../alerts/live';
import { isPushServiceUrl } from './push.service';

describe('push endpoints', () => {
  it('accepts the browser push services', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc:123',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://web.push.apple.com/QGZ1',
      'https://wns2-by3p.notify.windows.com/w/?token=AwYAAAB',
    ]) {
      assert.equal(isPushServiceUrl(endpoint), true, endpoint);
    }
  });

  it('refuses anything the server should never POST to', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/abc', // not TLS
      'https://fcm.googleapis.com:8443/fcm/send/abc', // odd port
      'https://fcm.googleapis.com.evil.example/fcm', // suffix trick
      'https://evilfcm.googleapis.co/x',
      'https://127.0.0.1/push',
      'https://localhost/push',
      'https://169.254.169.254/latest/meta-data',
      'not a url',
    ]) {
      assert.equal(isPushServiceUrl(endpoint), false, endpoint);
    }
  });
});

describe('push click target', () => {
  it('opens our own pages and sends external links to the inbox', () => {
    assert.equal(pushTarget('/market/inbox/abc'), '/market/inbox/abc');
    assert.equal(pushTarget('https://store.steampowered.com/news'), '/alerts');
    assert.equal(pushTarget('//evil.example/path'), '/alerts');
    assert.equal(pushTarget(null), '/alerts');
  });
});
