import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { assertKey, IMMUTABLE, type ObjectStorage } from './object-storage';

export interface R2Settings {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Folder inside the bucket ("tg-hub"), or "" for the root. */
  prefix: string;
}

/** Where a storage key lives in the bucket: "tg-hub/<key>". */
export const objectPath = (prefix: string, key: string) => (prefix ? `${prefix}/${key}` : key);

const notFound = (error: unknown) =>
  error instanceof S3ServiceException && (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata.httpStatusCode === 404);

/**
 * Cloudflare R2 through its S3-compatible API. Every object goes under the
 * configured folder, so the bucket can be shared with other projects; it's
 * written with its content type and a forever cache header, so the bucket's
 * public domain can serve it straight to browsers.
 */
export class R2Storage implements ObjectStorage {
  readonly driver = 'r2' as const;
  private readonly client: S3Client;

  constructor(private readonly settings: R2Settings) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: settings.endpoint,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      forcePathStyle: true,
      // R2 doesn't accept every checksum header newer SDKs add by default; only send them when an operation requires it.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3,
    });
  }

  private path(key: string): string {
    assertKey(key);
    return objectPath(this.settings.prefix, key);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.settings.bucket, Key: this.path(key), Body: body, ContentType: contentType, CacheControl: IMMUTABLE }));
  }

  async open(key: string) {
    try {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: this.path(key) }));
      if (!object.Body) return null;
      return { stream: object.Body as Readable, size: object.ContentLength ?? 0 };
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  /** Cheap existence check (no body), used when copying existing uploads over. */
  async has(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.settings.bucket, Key: this.path(key) }));
      return true;
    } catch (error) {
      if (notFound(error)) return false;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    // Deleting a key that's already gone succeeds, like the local driver.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: this.path(key) }));
  }
}
