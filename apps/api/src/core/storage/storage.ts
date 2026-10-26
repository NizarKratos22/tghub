import { env } from '../../config/env';
import { LocalDiskStorage } from './local-disk';
import type { ObjectStorage } from './object-storage';
import { objectPath, R2Storage } from './r2';

export type { ObjectStorage } from './object-storage';

/** Cloudflare R2 when its keys are set, otherwise the local `MEDIA_DIR`. */
export const storage: ObjectStorage = env.r2 ? new R2Storage(env.r2) : new LocalDiskStorage(env.MEDIA_DIR);

/** Address browsers load an object from: the bucket's public domain (and folder), or null when files go through the API. */
export function publicObjectUrl(key: string): string | null {
  return env.r2?.publicUrl ? `${env.r2.publicUrl}/${objectPath(env.r2.prefix, encodeURIComponent(key))}` : null;
}
