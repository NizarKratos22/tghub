import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Readable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import { IMMUTABLE } from './object-storage';
import { objectPath, R2Storage } from './r2';

/** Just enough of the S3 API (path-style PUT/GET/HEAD/DELETE) to exercise the driver without real credentials. */
function fakeBucketServer() {
  const objects = new Map<string, { body: Buffer; type: string | undefined; cache: string | undefined }>();
  const requests: Array<{ method: string; path: string; headers: IncomingHttpHeaders }> = [];
  const read = async (req: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  };
  const server = createServer(async (req, res) => {
    const body = await read(req);
    const path = decodeURIComponent(new URL(req.url!, 'http://bucket.test').pathname);
    requests.push({ method: req.method!, path, headers: req.headers });
    const object = objects.get(path);
    switch (req.method) {
      case 'PUT':
        objects.set(path, { body, type: req.headers['content-type'], cache: req.headers['cache-control'] });
        res.writeHead(200, { ETag: '"etag"' }).end();
        return;
      case 'GET':
      case 'HEAD':
        if (!object) {
          res.writeHead(404, { 'Content-Type': 'application/xml' });
          res.end(req.method === 'HEAD' ? undefined : '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>');
          return;
        }
        res.writeHead(200, { 'Content-Type': object.type ?? 'application/octet-stream', 'Content-Length': object.body.length, 'Cache-Control': object.cache ?? '' });
        res.end(req.method === 'HEAD' ? undefined : object.body);
        return;
      case 'DELETE':
        objects.delete(path);
        res.writeHead(204).end();
        return;
      default:
        res.writeHead(405).end();
    }
  });
  return { server, objects, requests };
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

describe('R2Storage', () => {
  const fake = fakeBucketServer();
  let r2: R2Storage;

  before(async () => {
    await new Promise<void>((resolve) => fake.server.listen(0, '127.0.0.1', resolve));
    const { port } = fake.server.address() as AddressInfo;
    r2 = new R2Storage({ endpoint: `http://127.0.0.1:${port}`, accessKeyId: 'test-access-key-id', secretAccessKey: 'test-secret-access-key', bucket: 'tgh-media', prefix: 'tg-hub' });
  });
  after(() => fake.server.close());

  test('writes objects path-style inside the folder, with their type and a forever cache header, signed with SigV4', async () => {
    const image = Buffer.from('RIFF....WEBPVP8 fake image');
    await r2.put('6adc77f361b4b5a911c959a6-full.webp', image, 'image/webp');

    const stored = fake.objects.get('/tgh-media/tg-hub/6adc77f361b4b5a911c959a6-full.webp');
    assert.ok(stored, 'object stored under /<bucket>/<folder>/<key>');
    assert.deepEqual(stored.body, image);
    assert.equal(stored.type, 'image/webp');
    assert.equal(stored.cache, IMMUTABLE);

    const put = fake.requests.find((r) => r.method === 'PUT')!;
    assert.match(String(put.headers.authorization), /^AWS4-HMAC-SHA256 Credential=test-access-key-id\/\d{8}\/auto\/s3\/aws4_request/);
    assert.equal(put.headers['x-amz-checksum-crc32'], undefined, 'no optional checksum headers');
  });

  test('reads an object back as a stream with its size', async () => {
    const opened = await r2.open('6adc77f361b4b5a911c959a6-full.webp');
    assert.ok(opened);
    const body = await readAll(opened.stream);
    assert.equal(body.toString(), 'RIFF....WEBPVP8 fake image');
    assert.equal(opened.size, body.length);
  });

  test('reports missing objects as null / false instead of throwing', async () => {
    assert.equal(await r2.open('000000000000000000000000-full.webp'), null);
    assert.equal(await r2.has('000000000000000000000000-full.webp'), false);
    assert.equal(await r2.has('6adc77f361b4b5a911c959a6-full.webp'), true);
  });

  test('removes objects, and removing twice is fine', async () => {
    await r2.remove('6adc77f361b4b5a911c959a6-full.webp');
    assert.equal(fake.objects.size, 0);
    await r2.remove('6adc77f361b4b5a911c959a6-full.webp');
    assert.equal(await r2.open('6adc77f361b4b5a911c959a6-full.webp'), null);
  });

  test('builds object paths with and without a folder', () => {
    assert.equal(objectPath('tg-hub', 'a-full.webp'), 'tg-hub/a-full.webp');
    assert.equal(objectPath('', 'a-full.webp'), 'a-full.webp');
  });

  test('refuses unsafe keys before sending anything', async () => {
    const before = fake.requests.length;
    await assert.rejects(r2.put('../escape.webp', Buffer.from('x'), 'image/webp'), /Unsafe storage key/);
    await assert.rejects(r2.open('a/b.webp'), /Unsafe storage key/);
    assert.equal(fake.requests.length, before);
  });
});
