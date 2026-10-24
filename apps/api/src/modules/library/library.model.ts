import { model, Schema, type Types } from 'mongoose';
import { BOOKMARK_TARGETS, type BookmarkTarget } from '@tgh/shared';

/** Favorites — one row per (user, target). */
export interface BookmarkDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  targetType: BookmarkTarget;
  targetId: Types.ObjectId;
  createdAt: Date;
}

const bookmarkSchema = new Schema<BookmarkDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: BOOKMARK_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookmarkSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
bookmarkSchema.index({ userId: 1, targetType: 1, createdAt: -1 });
bookmarkSchema.index({ targetType: 1, targetId: 1 });

export const Bookmark = model<BookmarkDoc>('Bookmark', bookmarkSchema);

/** Recently viewed — upserted on each view; `viewDay` makes "unique views per day" cheap. */
export interface RecentViewDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  targetType: BookmarkTarget;
  targetId: Types.ObjectId;
  viewedAt: Date;
  viewDay: string;
}

const recentViewSchema = new Schema<RecentViewDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: BOOKMARK_TARGETS, required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  viewedAt: { type: Date, required: true },
  viewDay: { type: String, required: true },
});

recentViewSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
recentViewSchema.index({ userId: 1, viewedAt: -1 });
// Old history isn't useful; let MongoDB trim it.
recentViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const RecentView = model<RecentViewDoc>('RecentView', recentViewSchema);
