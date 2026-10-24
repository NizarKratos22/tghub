import { model, Schema, type Types } from 'mongoose';
import { ACTIVITY_TYPES, type ActivityType } from '@tgh/shared';

/** One-way: following someone needs no approval, like a player profile on a tournament site. */
export interface FollowDoc {
  _id: Types.ObjectId;
  followerId: Types.ObjectId;
  followeeId: Types.ObjectId;
  createdAt: Date;
}

const followSchema = new Schema<FollowDoc>(
  {
    followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    followeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

followSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
followSchema.index({ followeeId: 1, _id: -1 });
followSchema.index({ followerId: 1, _id: -1 });

export const Follow = model<FollowDoc>('Follow', followSchema);

export type ActivityVisual = { kind: 'image'; url: string } | { kind: 'mark'; label: string; color: string } | null;

/**
 * Something a player did, written by event listeners. `dedupKey` makes
 * replays and toggles (unfavourite, favourite again) record once.
 */
export interface ActivityDoc {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  type: ActivityType;
  text: string;
  target: { label: string; href: string } | null;
  detail: string | null;
  visual: ActivityVisual;
  dedupKey: string | null;
  gg: number;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    text: { type: String, required: true },
    target: { type: new Schema({ label: String, href: String }, { _id: false }), default: null },
    detail: { type: String, default: null },
    visual: { type: Schema.Types.Mixed, default: null },
    dedupKey: { type: String, default: null },
    gg: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ actorId: 1, _id: -1 });
activitySchema.index({ dedupKey: 1 }, { unique: true, partialFilterExpression: { dedupKey: { $type: 'string' } } });
// The feed is about what's happening now; half a year is plenty of history.
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export const Activity = model<ActivityDoc>('Activity', activitySchema, 'activities');

/** "GG" — one per player per activity. */
export interface ActivityGgDoc {
  _id: Types.ObjectId;
  activityId: Types.ObjectId;
  userId: Types.ObjectId;
}

const activityGgSchema = new Schema<ActivityGgDoc>({
  activityId: { type: Schema.Types.ObjectId, ref: 'Activity', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

activityGgSchema.index({ activityId: 1, userId: 1 }, { unique: true });

export const ActivityGg = model<ActivityGgDoc>('ActivityGg', activityGgSchema, 'activity_ggs');
