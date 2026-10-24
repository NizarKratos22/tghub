import { model, Schema } from 'mongoose';
import { isDuplicateKeyError } from '../http/errors';

/**
 * "Has this already happened today?" marks. Used to make reward-bearing events
 * count once — checking the same game ten times is still one check.
 */
const activityMarkSchema = new Schema(
  { key: { type: String, required: true, unique: true } },
  { timestamps: { createdAt: true, updatedAt: false } },
);
activityMarkSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 8 });

export const ActivityMark = model('ActivityMark', activityMarkSchema, 'activity_marks');

/** Resolves true the first time `key` is seen, false afterwards. */
export async function firstTime(key: string): Promise<boolean> {
  try {
    await ActivityMark.create({ key });
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}
