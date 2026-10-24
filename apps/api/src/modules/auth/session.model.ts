import { model, Schema, type Types } from 'mongoose';

/** One row per signed-in device. Refresh tokens are stored hashed and rotate on use. */
export interface SessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  /** The token that was rotated out last — presenting it again signals theft. */
  previousTokenHash: string | null;
  rotatedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date;
  userAgent: string;
  ip: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    previousTokenHash: { type: String, default: null, index: true },
    rotatedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: () => new Date() },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);

// MongoDB deletes expired sessions on its own.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<SessionDoc>('Session', sessionSchema);
