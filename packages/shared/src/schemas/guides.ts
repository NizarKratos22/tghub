import { z } from 'zod';

const https = (message: string) =>
  z
    .url(message)
    .max(300)
    .refine((url) => url.startsWith('https://'), 'Use an https:// link');

/** A competitive guide for one game, written by the TG Hub team in Admin → Guides. */
export const guideInputSchema = z.object({
  published: z.boolean().default(false),
  intro: z.string().trim().min(20, 'Write a short introduction').max(500),
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(60),
        items: z
          .array(z.object({ label: z.string().trim().min(2).max(60), text: z.string().trim().min(3).max(300) }))
          .min(1, 'Add at least one point')
          .max(12),
      }),
    )
    .max(8)
    .default([]),
  /** Overwolf apps worth installing for this game: overlays, stats, auto-clips. */
  overwolfApps: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        url: https('Paste the app’s Overwolf page'),
        description: z.string().trim().min(10).max(200),
      }),
    )
    .max(8)
    .default([]),
  /** Overwolf's "apps for this game" page, for everything else. */
  overwolfStoreUrl: https('Paste Overwolf’s page for this game').nullable().default(null),
});
export type GuideInput = z.infer<typeof guideInputSchema>;
