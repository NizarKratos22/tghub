import { createPublicKey, verify, type KeyObject } from 'node:crypto';

/** DER prefix that turns a raw 32-byte Ed25519 key into SPKI, which Node's crypto accepts. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const keys = new Map<string, KeyObject>();

function keyFor(publicKeyHex: string): KeyObject {
  let key = keys.get(publicKeyHex);
  if (!key) {
    key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
    keys.set(publicKeyHex, key);
  }
  return key;
}

/**
 * Discord signs every interaction: Ed25519 over timestamp + raw body. Requests
 * that fail this must get a 401 — Discord itself probes the endpoint with bad
 * signatures before accepting it.
 */
export function verifyDiscordSignature(publicKeyHex: string, signatureHex: string | undefined, timestamp: string | undefined, rawBody: Buffer | undefined): boolean {
  if (!signatureHex || !timestamp || !rawBody || !/^[0-9a-f]{128}$/i.test(signatureHex)) return false;
  try {
    return verify(null, Buffer.concat([Buffer.from(timestamp, 'utf8'), rawBody]), keyFor(publicKeyHex), Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}
