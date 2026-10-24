import { model, Schema, type Types } from 'mongoose';

export const CODE_PURPOSES = ['signup', 'email_change', 'password_reset'] as const;
export type CodePurpose = (typeof CODE_PURPOSES)[number];

/**
 * A pending 6-digit code, one per (account, purpose), replaced on resend.
 * Only a keyed hash is stored; `target` is the address the code went to,
 * so a code can't be redeemed for a different email than it was sent to.
 */
export interface OneTimeCodeDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  purpose: CodePurpose;
  target: string;
  codeHash: string;
  attempts: number;
  sentAt: Date;
  /** Sends in the current 24 h window, for the daily cap. */
  sendsToday: number;
  windowStartedAt: Date;
  expiresAt: Date;
}

const oneTimeCodeSchema = new Schema<OneTimeCodeDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: CODE_PURPOSES, required: true },
  target: { type: String, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, required: true },
  sendsToday: { type: Number, default: 1 },
  windowStartedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

oneTimeCodeSchema.index({ userId: 1, purpose: 1 }, { unique: true });
// Keep rows a day past expiry so the resend cooldown and daily cap still apply.
oneTimeCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const OneTimeCode = model<OneTimeCodeDoc>('OneTimeCode', oneTimeCodeSchema, 'one_time_codes');
