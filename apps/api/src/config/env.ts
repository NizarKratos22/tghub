import { existsSync } from 'node:fs';
import { z } from 'zod';

if (existsSync('.env')) process.loadEnvFile('.env');

/** Blank lines in .env (`KEY=`) mean "not configured". */
const optionalSecret = z.preprocess((value) => (value === '' ? undefined : value), z.string().trim().min(10).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  MONGO_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/tghub'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** Proxies in front of the API: 1 = the Next.js rewrite (dev); 2 = Caddy + Next.js (docker-compose.prod). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_SECURE: z.stringbool().default(false),
  INGESTION_ENABLED: z.stringbool().default(false),
  /** Tournament platforms — each provider stays off until its credential is set. */
  START_GG_TOKEN: optionalSecret,
  FACEIT_API_KEY: optionalSecret,
  /** Where uploaded images live with the local-disk storage driver. */
  MEDIA_DIR: z.string().min(1).default('var/media'),
  MEDIA_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(25).default(8),
  /** Outgoing mail, e.g. smtp://user:pass@smtp.example.com:587. Unset = emails are written to the log (development only). */
  SMTP_URL: z.preprocess((value) => (value === '' ? undefined : value), z.string().regex(/^smtps?:\/\//, 'Use an smtp:// or smtps:// URL').optional()),
  MAIL_FROM: z.string().min(3).default('TG Hub <no-reply@tghub.tn>'),
  /** Web push (browser and phone notifications). Generate with `npx web-push generate-vapid-keys`; development makes its own. */
  VAPID_PUBLIC_KEY: optionalSecret,
  VAPID_PRIVATE_KEY: optionalSecret,
  /** Where players reach the web app; OAuth callbacks and bot links are built from it. */
  PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),
  /** Discord sign-in and account linking (OAuth2). Both values from the Discord developer portal. */
  DISCORD_CLIENT_ID: z.preprocess((value) => (value === '' ? undefined : value), z.string().regex(/^\d{15,25}$/, 'Discord application id').optional()),
  DISCORD_CLIENT_SECRET: optionalSecret,
  /** Discord bot: verifies interaction signatures (hex public key) and registers slash commands. */
  DISCORD_PUBLIC_KEY: z.preprocess((value) => (value === '' ? undefined : value), z.string().regex(/^[0-9a-f]{64}$/i, '64 hex characters').optional()),
  DISCORD_BOT_TOKEN: optionalSecret,
  /** Steam Web API key: profile names and owned games. Linking itself works without it. */
  STEAM_API_KEY: optionalSecret,
  /** Payments for featured listings. Unset = Flouci if its keys exist, then Konnect, then the local test checkout (development only). */
  PAYMENT_PROVIDER: z.preprocess((value) => (value === '' ? undefined : value), z.enum(['flouci', 'konnect', 'dev']).optional()),
  FLOUCI_PUBLIC_KEY: optionalSecret,
  FLOUCI_PRIVATE_KEY: optionalSecret,
  KONNECT_API_KEY: optionalSecret,
  KONNECT_WALLET_ID: z.preprocess((value) => (value === '' ? undefined : value), z.string().min(8).optional()),
  KONNECT_SANDBOX: z.stringbool().default(true),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/, 'Use a mailto: or https:// contact').default('mailto:support@tghub.tn'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (parsed.success && parsed.data.NODE_ENV === 'production' && !parsed.data.SMTP_URL) {
  console.error('SMTP_URL is required in production — verification emails cannot be delivered without it.');
  process.exit(1);
}

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
};
