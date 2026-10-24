import { model, Schema, type Types } from 'mongoose';
import { RESOURCE_KINDS, type ResourceKind } from '@tgh/shared';

/** Anything on the Radar that isn't a game: news, patch notes, guides, deals, events. */
export interface ResourceDoc {
  _id: Types.ObjectId;
  kind: ResourceKind;
  title: string;
  titleLower: string;
  summary: string;
  url: string;
  sourceName: string;
  /** Stable id from an ingested feed (e.g. "steam:5123…") — prevents duplicates. */
  externalId: string | null;
  gameId: Types.ObjectId | null;
  tags: string[];
  publishedAt: Date;
  startsAt: Date | null;
  expiresAt: Date | null;
  location: string | null;
  deal: {
    store: string;
    price: number;
    originalPrice: number | null;
    currency: string;
  } | null;
  status: 'published' | 'hidden';
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const dealSchema = new Schema(
  {
    store: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, default: null },
    currency: { type: String, default: 'USD' },
  },
  { _id: false },
);

const resourceSchema = new Schema<ResourceDoc>(
  {
    kind: { type: String, enum: RESOURCE_KINDS, required: true },
    title: { type: String, required: true },
    titleLower: { type: String, required: true },
    summary: { type: String, default: '' },
    url: { type: String, required: true },
    sourceName: { type: String, required: true },
    externalId: { type: String, default: null },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    tags: { type: [String], default: [] },
    publishedAt: { type: Date, default: () => new Date() },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    location: { type: String, default: null },
    deal: { type: dealSchema, default: null },
    status: { type: String, enum: ['published', 'hidden'], default: 'published' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

resourceSchema.index({ status: 1, kind: 1, publishedAt: -1 });
resourceSchema.index({ gameId: 1, publishedAt: -1 });
resourceSchema.index({ kind: 1, expiresAt: 1 });
resourceSchema.index({ kind: 1, startsAt: 1 });
resourceSchema.index({ titleLower: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index(
  { externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } },
);

export const Resource = model<ResourceDoc>('Resource', resourceSchema);
