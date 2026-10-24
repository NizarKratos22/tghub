import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug');

/** Optional search box value: blank input behaves like no filter. */
export const optionalSearchSchema = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((value) => (value ? value : undefined));

export const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);
export const pageSizeSchema = z.coerce.number().int().min(1).max(48).default(24);

export const idParamsSchema = z.object({ id: objectIdSchema });
export const slugParamsSchema = z.object({ slug: slugSchema });

export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a #rrggbb colour');
