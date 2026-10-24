import { z } from 'zod';
import { COMPONENT_BRANDS, COMPONENT_SEGMENTS, COMPONENT_TYPES, OPERATING_SYSTEMS } from '../constants';
import { objectIdSchema, optionalSearchSchema, slugSchema } from './common';

export const componentQuerySchema = z.object({
  type: z.enum(COMPONENT_TYPES),
  q: optionalSearchSchema,
  brand: z.enum(COMPONENT_BRANDS).optional(),
  segment: z.enum(COMPONENT_SEGMENTS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ComponentQuery = z.infer<typeof componentQuerySchema>;

export const ramGbSchema = z.number().int().min(2).max(256);

export const specHardwareSchema = z.object({
  cpuId: objectIdSchema,
  gpuId: objectIdSchema,
  ramGb: ramGbSchema,
  /** Free disk space. Optional: many players don't know it offhand. */
  storageGb: z.number().int().min(0).max(20_000).nullable().default(null),
});
export type SpecHardwareInput = z.infer<typeof specHardwareSchema>;

export const pcSpecInputSchema = specHardwareSchema.extend({
  name: z.string().trim().min(1, 'Give this rig a name').max(40),
  os: z.enum(OPERATING_SYSTEMS).default('windows-11'),
  isPrimary: z.boolean().default(false),
});
export type PcSpecInput = z.infer<typeof pcSpecInputSchema>;

export const pcSpecUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    cpuId: objectIdSchema,
    gpuId: objectIdSchema,
    ramGb: ramGbSchema,
    storageGb: z.number().int().min(0).max(20_000).nullable(),
    os: z.enum(OPERATING_SYSTEMS),
    isPrimary: z.boolean(),
  })
  .partial();

export const compatCheckSchema = z
  .object({
    gameSlug: slugSchema,
    specId: objectIdSchema.optional(),
    spec: specHardwareSchema.optional(),
  })
  .refine((value) => Boolean(value.specId || value.spec), {
    message: 'Pick a saved rig or enter your hardware',
    path: ['spec'],
  });
export type CompatCheckInput = z.infer<typeof compatCheckSchema>;

export const compatibleGamesQuerySchema = z
  .object({
    specId: objectIdSchema.optional(),
    cpuId: objectIdSchema.optional(),
    gpuId: objectIdSchema.optional(),
    ramGb: z.coerce.number().int().min(2).max(256).optional(),
  })
  .refine((value) => Boolean(value.specId || (value.cpuId && value.gpuId && value.ramGb)), {
    message: 'Pick a saved rig or enter your hardware',
  });
