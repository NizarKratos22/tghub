import { model, Schema, type Types } from 'mongoose';

export const MEDIA_PURPOSES = ['listing', 'avatar', 'banner'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

/**
 * An uploaded image. Files are stored as "<id>-full.webp" and "<id>-thumb.webp".
 * `orphanSince` is set while nothing references the image (fresh uploads,
 * photos removed from a listing); the cleanup job deletes old orphans.
 */
export interface MediaDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  purpose: MediaPurpose;
  width: number;
  height: number;
  bytes: number;
  attachedTo: Types.ObjectId | null;
  orphanSince: Date | null;
  createdAt: Date;
}

const mediaSchema = new Schema<MediaDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: MEDIA_PURPOSES, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    bytes: { type: Number, required: true },
    attachedTo: { type: Schema.Types.ObjectId, default: null },
    orphanSince: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

mediaSchema.index({ ownerId: 1, createdAt: -1 });
mediaSchema.index({ orphanSince: 1 }, { partialFilterExpression: { orphanSince: { $type: 'date' } } });

export const Media = model<MediaDoc>('Media', mediaSchema);
