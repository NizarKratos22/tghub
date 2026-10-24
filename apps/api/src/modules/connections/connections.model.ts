import { model, Schema, type Types } from 'mongoose';

export const CONNECTION_PROVIDERS = ['discord', 'steam'] as const;
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

/** A linked outside account. One per provider per player, and one player per outside account. */
export interface ConnectionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  provider: ConnectionProvider;
  externalId: string;
  username: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  /** Steam library snapshot (app id + minutes played). */
  games: Array<{ appId: number; minutes: number }>;
  gamesSyncedAt: Date | null;
  createdAt: Date;
}

const connectionSchema = new Schema<ConnectionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: CONNECTION_PROVIDERS, required: true },
    externalId: { type: String, required: true },
    username: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    profileUrl: { type: String, default: null },
    games: { type: [new Schema({ appId: Number, minutes: Number }, { _id: false })], default: [] },
    gamesSyncedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

connectionSchema.index({ provider: 1, externalId: 1 }, { unique: true });
connectionSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const Connection = model<ConnectionDoc>('Connection', connectionSchema);
