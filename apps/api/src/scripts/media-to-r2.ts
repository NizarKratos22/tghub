/**
 * Copies images already on this server's disk (MEDIA_DIR) into the R2 bucket,
 * so switching to R2 doesn't break uploads made before it. Safe to run again:
 * objects already in the bucket are skipped. Local files are left in place.
 *   npm run media:to-r2 -w apps/api
 *   docker compose -f docker-compose.prod.yml exec api node dist/scripts/media-to-r2.js
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { R2Storage } from '../core/storage/r2';

if (!env.r2) {
  console.error('R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET first.');
  process.exit(1);
}

const bucket = new R2Storage(env.r2);
const root = path.resolve(env.MEDIA_DIR);
const files = await readdir(root).catch(() => [] as string[]);
const images = files.filter((name) => /^[a-f\d]{24}-(full|thumb)\.webp$/i.test(name));

let copied = 0;
let skipped = 0;
for (const name of images) {
  if (await bucket.has(name)) {
    skipped += 1;
    continue;
  }
  await bucket.put(name, await readFile(path.join(root, name)), 'image/webp');
  copied += 1;
  if (copied % 50 === 0) console.log(`… ${copied} copied`);
}

console.log(`${images.length} images in ${root}: ${copied} copied to R2 "${env.r2.bucket}/${env.r2.prefix}", ${skipped} already there.`);
process.exit(0);
