import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { interactionsHandler } from './discord.routes';
import { verifyDiscordSignature } from './signature';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
// The raw key is the last 32 bytes of the SPKI encoding — the hex form Discord shows in its portal.
const publicKeyHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');

function signed(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
  return { signature, timestamp };
}

describe('Discord signature', () => {
  it('accepts the exact signed bytes', () => {
    const body = '{"type":1}';
    const { signature, timestamp } = signed(body);
    assert.equal(verifyDiscordSignature(publicKeyHex, signature, timestamp, Buffer.from(body)), true);
  });

  it('rejects tampered bodies, timestamps and garbage', () => {
    const body = '{"type":1}';
    const { signature, timestamp } = signed(body);
    assert.equal(verifyDiscordSignature(publicKeyHex, signature, timestamp, Buffer.from('{"type":2}')), false);
    assert.equal(verifyDiscordSignature(publicKeyHex, signature, String(Number(timestamp) + 1), Buffer.from(body)), false);
    assert.equal(verifyDiscordSignature(publicKeyHex, 'zz', timestamp, Buffer.from(body)), false);
    assert.equal(verifyDiscordSignature(publicKeyHex, undefined, timestamp, Buffer.from(body)), false);
  });
});

describe('interactions endpoint', () => {
  let base = '';
  let close: () => void = () => {};

  before(async () => {
    const app = express();
    app.use(express.json({ verify: (req, _res, buf) => ((req as express.Request).rawBody = buf) }));
    app.post('/interactions', interactionsHandler(publicKeyHex));
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });
  after(() => close());

  const post = (body: string, headers: Record<string, string>) =>
    fetch(`${base}/interactions`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

  it('answers a signed PING with PONG', async () => {
    const body = JSON.stringify({ type: 1 });
    const { signature, timestamp } = signed(body);
    const response = await post(body, { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { type: 1 });
  });

  it('refuses unsigned or badly signed requests with 401', async () => {
    const body = JSON.stringify({ type: 1 });
    assert.equal((await post(body, {})).status, 401);
    const { signature, timestamp } = signed('{"type":2}');
    assert.equal((await post(body, { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp })).status, 401);
  });

  it('turns unknown commands into a private reply instead of an error', async () => {
    const body = JSON.stringify({ type: 2, data: { name: 'something-else' } });
    const { signature, timestamp } = signed(body);
    const response = await post(body, { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp });
    const json = (await response.json()) as { type: number; data: { flags: number } };
    assert.equal(json.type, 4);
    assert.equal(json.data.flags, 64);
  });
});
