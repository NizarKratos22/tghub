import { z } from 'zod';
import { AVATAR_COLORS, COUNTRY_CODES, TN_GOVERNORATES } from '../constants';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address'));

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, dots and underscores only');

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters');

export const countrySchema = z.enum(COUNTRY_CODES, 'Pick a country');
export const governorateSchema = z.enum(TN_GOVERNORATES, 'Pick a governorate');

/** A governorate only makes sense for players in Tunisia. */
function governorateNeedsTunisia(value: { country?: string | null; region?: string | null }, ctx: z.RefinementCtx) {
  if (value.region && value.country && value.country !== 'TN') {
    ctx.addIssue({ code: 'custom', path: ['region'], message: 'Governorates are for players in Tunisia' });
  }
}

export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    country: countrySchema.optional(),
    region: governorateSchema.optional(),
  })
  .superRefine(governorateNeedsTunisia);
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, { path: ['newPassword'], message: 'Pick a password you are not using now' });

export const changeEmailSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password to confirm').max(128),
});

export const loginSchema = z.object({
  /** Email or username. */
  identifier: z.string().trim().min(3, 'Enter your email or username').max(254),
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Native clients send the refresh token in the body; the web uses a cookie. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
});

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(32),
    bio: z.string().trim().max(280),
    country: countrySchema.nullable(),
    region: governorateSchema.nullable(),
    avatarColor: z.enum(AVATAR_COLORS),
    /** Show level-ups, listings and clan moves in followers' feeds. */
    shareActivity: z.boolean(),
  })
  .partial()
  .superRefine(governorateNeedsTunisia);
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const equipTitleSchema = z.object({
  title: z.string().trim().min(1).max(40).nullable(),
});
