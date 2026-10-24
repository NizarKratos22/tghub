import { Types } from 'mongoose';
import sharp from 'sharp';
import type { MarketPhoto } from '@tgh/shared';
import { AppError } from '../../core/http/errors';
import { logger } from '../../core/logger';
import { storage } from '../../core/storage/storage';
import { Media, type MediaDoc, type MediaPurpose } from './media.model';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif', 'avif', 'tiff']);
/** Decompression-bomb guard: refuse anything above ~40 megapixels before decoding it. */
const MAX_INPUT_PIXELS = 40_000_000;
/**
 * How each kind of image is cut. Listings keep their shape (full) with a square
 * thumbnail; avatars are square; banners are a 4:1 strip.
 */
const PRESETS: Record<MediaPurpose, { full: { width: number; height: number; fit: 'inside' | 'cover' }; thumb: { width: number; height: number }; min: [number, number] }> = {
  listing: { full: { width: 1600, height: 1600, fit: 'inside' }, thumb: { width: 480, height: 480 }, min: [200, 200] },
  avatar: { full: { width: 512, height: 512, fit: 'cover' }, thumb: { width: 128, height: 128 }, min: [96, 96] },
  banner: { full: { width: 1600, height: 400, fit: 'cover' }, thumb: { width: 800, height: 200 }, min: [600, 150] },
};
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

export type MediaVariant = 'full' | 'thumb';

export function mediaKey(id: string | Types.ObjectId, variant: MediaVariant): string {
  return `${String(id)}-${variant}.webp`;
}

/** Same-origin path: the web app proxies /api/v1, native clients prefix the API host. */
export function mediaUrl(id: string | Types.ObjectId, variant: MediaVariant): string {
  return `/api/v1/media/${mediaKey(id, variant)}`;
}

export function toPhoto(doc: Pick<MediaDoc, '_id' | 'width' | 'height'>): MarketPhoto {
  return {
    id: String(doc._id),
    url: mediaUrl(doc._id, 'full'),
    thumbUrl: mediaUrl(doc._id, 'thumb'),
    width: doc.width,
    height: doc.height,
  };
}

function unreadable(message = "That file isn't an image we can read — use JPG, PNG or WebP") {
  return AppError.unprocessable(message, { fields: { file: message } });
}

/**
 * Re-encodes every upload. Besides resizing, this is what strips EXIF data —
 * phone photos carry GPS coordinates, and a marketplace must never leak a
 * seller's home location.
 */
export async function processImage(input: Buffer, purpose: MediaPurpose = 'listing'): Promise<{ full: Buffer; thumb: Buffer; width: number; height: number }> {
  const preset = PRESETS[purpose];
  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).format;
  } catch {
    throw unreadable();
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw unreadable();

  try {
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).autoOrient();
    const source = await base.clone().metadata();
    const [minWidth, minHeight] = preset.min;
    const sourceWidth = (source.autoOrient?.width ?? source.width) || 0;
    const sourceHeight = (source.autoOrient?.height ?? source.height) || 0;
    if (sourceWidth < minWidth || sourceHeight < minHeight) {
      throw unreadable(`Images need to be at least ${minWidth}×${minHeight} pixels`);
    }
    const full = await base
      .clone()
      .resize({
        width: preset.full.width,
        height: preset.full.height,
        fit: preset.full.fit,
        position: preset.full.fit === 'cover' ? sharp.strategy.attention : undefined,
        withoutEnlargement: preset.full.fit === 'inside',
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base
      .clone()
      .resize({ width: preset.thumb.width, height: preset.thumb.height, fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 78 })
      .toBuffer();
    return { full: full.data, thumb, width: full.info.width, height: full.info.height };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unreadable();
  }
}

export async function storeImage(ownerId: string, purpose: MediaPurpose, input: Buffer): Promise<MarketPhoto> {
  const image = await processImage(input, purpose);
  const id = new Types.ObjectId();
  await Promise.all([storage.put(mediaKey(id, 'full'), image.full), storage.put(mediaKey(id, 'thumb'), image.thumb)]);
  const doc = await Media.create({
    _id: id,
    ownerId,
    purpose,
    width: image.width,
    height: image.height,
    bytes: image.full.length + image.thumb.length,
    orphanSince: new Date(),
  });
  return toPhoto(doc);
}

/** All ids must be the owner's own uploads of that kind; returns them in the order given. */
export async function ownedMedia(ownerId: string, ids: string[], purpose: MediaPurpose = 'listing'): Promise<MediaDoc[]> {
  const docs = await Media.find({ _id: { $in: ids }, ownerId, purpose }).lean<MediaDoc[]>();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const ordered = ids.map((id) => byId.get(id));
  if (ordered.some((doc) => !doc)) {
    const message = 'Some photos are no longer available — upload them again';
    throw AppError.unprocessable(message, { fields: { photoIds: message } });
  }
  return ordered as MediaDoc[];
}

export async function attachMedia(ids: Array<string | Types.ObjectId>, targetId: Types.ObjectId | string): Promise<void> {
  if (ids.length === 0) return;
  await Media.updateMany({ _id: { $in: ids } }, { $set: { attachedTo: targetId, orphanSince: null } });
}

/** Unreferenced images are kept for a day (undo, slow form submits) and then cleaned up. */
export async function detachMedia(ids: Array<string | Types.ObjectId>): Promise<void> {
  if (ids.length === 0) return;
  await Media.updateMany({ _id: { $in: ids } }, { $set: { attachedTo: null, orphanSince: new Date() } });
}

export async function mediaByIds(ids: Array<string | Types.ObjectId>): Promise<Map<string, MediaDoc>> {
  if (ids.length === 0) return new Map();
  const docs = await Media.find({ _id: { $in: ids } }).select('width height').lean<MediaDoc[]>();
  return new Map(docs.map((doc) => [String(doc._id), doc]));
}

export async function deleteOrphanedMedia(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - ORPHAN_TTL_MS);
  const orphans = await Media.find({ orphanSince: { $lte: cutoff } }).select('_id').limit(500).lean<Array<Pick<MediaDoc, '_id'>>>();
  if (orphans.length === 0) return { deleted: 0 };
  for (const { _id } of orphans) {
    await Promise.all([storage.remove(mediaKey(_id, 'full')), storage.remove(mediaKey(_id, 'thumb'))]);
  }
  await Media.deleteMany({ _id: { $in: orphans.map((o) => o._id) } });
  logger.info({ deleted: orphans.length }, 'Orphaned media removed');
  return { deleted: orphans.length };
}
