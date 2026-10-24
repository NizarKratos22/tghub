import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, it, mock } from 'node:test';
import { flouciGateway, konnectGateway, verifyFlouciSignature } from './gateways';

const SECRET = 'flouci-private-test-key';

function sign(body: string, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

describe('Flouci webhook signature', () => {
  const body = JSON.stringify({ event: 'payment.succeeded', payment_id: 'abc', amount: 9000 });

  it('accepts a fresh, correctly signed body', () => {
    assert.equal(verifyFlouciSignature(sign(body), Buffer.from(body), SECRET), true);
  });

  it('rejects tampering, the wrong key, replays and garbage', () => {
    assert.equal(verifyFlouciSignature(sign(body), Buffer.from(body.replace('9000', '1')), SECRET), false);
    assert.equal(verifyFlouciSignature(sign(body), Buffer.from(body), 'another-key'), false);
    assert.equal(verifyFlouciSignature(sign(body, Math.floor(Date.now() / 1000) - 3600), Buffer.from(body), SECRET), false);
    assert.equal(verifyFlouciSignature('t=1,v1=zz', Buffer.from(body), SECRET), false);
    assert.equal(verifyFlouciSignature(undefined, Buffer.from(body), SECRET), false);
  });
});

/** Replaces fetch with a canned JSON answer. */
function answer(status: number, json: unknown) {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } }));
}

describe('gateway status', () => {
  afterEach(() => mock.restoreAll());

  it('Flouci: paid only when success, SUCCESS and the exact amount', async () => {
    answer(200, { success: true, result: { status: 'SUCCESS', amount: 9000 } });
    assert.equal(await flouciGateway.fetchStatus('p1', 9000), 'paid');
    answer(200, { success: true, result: { status: 'SUCCESS', amount: 1000 } });
    assert.equal(await flouciGateway.fetchStatus('p1', 9000), 'failed');
    answer(200, { success: true, result: { status: 'PENDING', amount: 9000 } });
    assert.equal(await flouciGateway.fetchStatus('p1', 9000), 'pending');
    answer(200, { success: true, result: { status: 'EXPIRED', amount: 9000 } });
    assert.equal(await flouciGateway.fetchStatus('p1', 9000), 'expired');
    answer(404, { result: { status: 404, message: 'Payment not found' } });
    assert.equal(await flouciGateway.fetchStatus('p1', 9000), 'pending');
  });

  it('Konnect: "completed" with the right amount is paid; an expired link is expired', async () => {
    answer(200, { payment: { status: 'completed', amount: 5000, token: 'TND' } });
    assert.equal(await konnectGateway.fetchStatus('ref', 5000), 'paid');
    answer(200, { payment: { status: 'completed', amount: 500, token: 'TND' } });
    assert.equal(await konnectGateway.fetchStatus('ref', 5000), 'failed');
    answer(200, { payment: { status: 'pending', amount: 5000, expirationDate: new Date(Date.now() - 60_000).toISOString() } });
    assert.equal(await konnectGateway.fetchStatus('ref', 5000), 'expired');
    answer(200, { payment: { status: 'pending', amount: 5000, expirationDate: new Date(Date.now() + 60_000).toISOString() } });
    assert.equal(await konnectGateway.fetchStatus('ref', 5000), 'pending');
  });
});
