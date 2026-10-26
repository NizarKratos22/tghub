import { model, Schema, type Types } from 'mongoose';

/** One competitive guide per game: settings, roles, habits, and the Overwolf apps worth installing. */
export interface GuideDoc {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  published: boolean;
  intro: string;
  sections: Array<{ title: string; items: Array<{ label: string; text: string }> }>;
  overwolfApps: Array<{ name: string; url: string; description: string }>;
  overwolfStoreUrl: string | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const guideSchema = new Schema<GuideDoc>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true, unique: true },
    published: { type: Boolean, default: false },
    intro: { type: String, required: true },
    sections: [
      {
        _id: false,
        title: { type: String, required: true },
        items: [{ _id: false, label: { type: String, required: true }, text: { type: String, required: true } }],
      },
    ],
    overwolfApps: [{ _id: false, name: String, url: String, description: String }],
    overwolfStoreUrl: { type: String, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
guideSchema.index({ published: 1, updatedAt: -1 });

export const Guide = model<GuideDoc>('Guide', guideSchema);
