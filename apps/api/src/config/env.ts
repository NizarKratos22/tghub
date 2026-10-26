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
  /** Where uploaded images live with the local-disk storage driver (used when R2 isn't configured). */
  MEDIA_DIR: z.string().min(1).default('var/media'),
  /**
   * Cloudflare R2 for uploaded images. The key pair, the bucket and the
   * account (its id, or the endpoint that contains it) together switch it on;
   * with none of them set, images stay on local disk.
   */
  R2_ACCOUNT_ID: z.preprocess((value) => (value === '' ? undefined : value), z.string().regex(/^[0-9a-f]{32}$/i, '32-character Cloudflare account id').optional()),
  R2_ACCESS_KEY_ID: optionalSecret,
  R2_SECRET_ACCESS_KEY: optionalSecret,
  R2_BUCKET: z.preprocess((value) => (value === '' ? undefined : value), z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, 'R2 bucket name: lowercase letters, digits and hyphens').optional()),
  /** The bucket's public address (custom domain or r2.dev), e.g. https://media.tghub.tn. Unset = images stream through the API. */
  R2_PUBLIC_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
  /** https://<account>.r2.cloudflarestorage.com (built from R2_ACCOUNT_ID when unset); EU buckets use <account>.eu.r2… */
  R2_ENDPOINT: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
  /** Folder inside the bucket, so TG Hub can share a bucket with other projects. Empty = the bucket root. */
  R2_PREFIX: z
    .string()
    .trim()
    .transform((value) => value.replace(/^\/+|\/+$/g, ''))
    .pipe(z.string().regex(/^([a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*)?$/i, 'Folder names: letters, digits, "-" and "_", separated by "/"'))
    .default('tg-hub'),
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
  /**
   * IGDB (via Twitch) — where the game catalogue's data comes from. The client id plus either the
   * client secret (tokens are fetched and renewed automatically) or a ready-made app access token.
   */
  IGDB_CLIENT_ID: z.preprocess((value) => (value === '' ? undefined : value), z.string().trim().regex(/^[a-z0-9]{20,40}$/i, 'Twitch client id').optional()),
  IGDB_CLIENT_SECRET: optionalSecret,
  /** "Bearer abc…" or just "abc…". App access tokens last about 60 days; prefer the client secret. */
  IGDB_TOKEN: z.preprocess((value) => (value === '' ? undefined : value), z.string().trim().transform((value) => value.replace(/^Bearer\s+/i, '')).pipe(z.string().min(10)).optional()),
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

const data = parsed.data;

// The account id is the first label of the S3 endpoint, so either one names the account.
const r2Account = data.R2_ACCOUNT_ID ?? data.R2_ENDPOINT?.match(/^https:\/\/([0-9a-f]{32})\./i)?.[1];
const r2Values = { R2_ACCESS_KEY_ID: data.R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: data.R2_SECRET_ACCESS_KEY, R2_BUCKET: data.R2_BUCKET, 'R2_ACCOUNT_ID or R2_ENDPOINT': r2Account ?? data.R2_ENDPOINT };
const r2Missing = Object.entries(r2Values).filter(([, value]) => !value).map(([key]) => key);
// Half a configuration would quietly keep uploads on the server's disk; refuse to start instead.
if (r2Missing.length > 0 && (r2Missing.length < Object.keys(r2Values).length || data.R2_PUBLIC_URL)) {
  console.error(`Cloudflare R2 is half configured. Missing: ${r2Missing.join(', ')} (or leave every R2_ variable empty to keep images on local disk).`);
  process.exit(1);
}

export const env = {
  ...data,
  isProduction: data.NODE_ENV === 'production',
  corsOrigins: data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  /** IGDB credentials when the catalogue syncs from IGDB, else null. */
  igdb:
    data.IGDB_CLIENT_ID && (data.IGDB_CLIENT_SECRET || data.IGDB_TOKEN)
      ? { clientId: data.IGDB_CLIENT_ID, clientSecret: data.IGDB_CLIENT_SECRET ?? null, token: data.IGDB_TOKEN ?? null }
      : null,
  /** Cloudflare R2 settings when uploads go there, else null (local disk). */
  r2:
    r2Missing.length === 0 && data.R2_ACCESS_KEY_ID && data.R2_SECRET_ACCESS_KEY && data.R2_BUCKET
      ? {
          accessKeyId: data.R2_ACCESS_KEY_ID,
          secretAccessKey: data.R2_SECRET_ACCESS_KEY,
          bucket: data.R2_BUCKET,
          endpoint: (data.R2_ENDPOINT ?? `https://${r2Account}.r2.cloudflarestorage.com`).replace(/\/+$/, ''),
          prefix: data.R2_PREFIX,
          publicUrl: data.R2_PUBLIC_URL?.replace(/\/+$/, '') ?? null,
        }
      : null,
};
