# Deploying TG Hub

One Linux server runs everything with Docker: **Caddy** (HTTPS) → **web** (Next.js) → **api** (Express) → **MongoDB**, plus a **backup** job. The browser only ever talks to your domain; the web app forwards `/api/v1/*` to the API inside the Docker network.

```
Internet ──443──▶ Caddy ──▶ web:3000 ──/api/v1──▶ api:4000 ──▶ mongo:27017
                                           backup ──▶ ./backups (daily)
```

## 1. Server

- A VPS with 2 vCPU / 4 GB RAM is plenty to start (Ubuntu 24.04 LTS). Tunisian hosts or a nearby EU region (Paris, Frankfurt, Milan) keep latency low.
- Install Docker Engine with the Compose plugin: <https://docs.docker.com/engine/install/ubuntu/>.
- Open ports **80** and **443** only. MongoDB is never exposed.
- Point your domain's DNS **A** (and **AAAA** if you have IPv6) record at the server, plus `www`. Caddy fetches the certificate itself once DNS resolves.

## 2. Configuration

```bash
git clone <your repository> tghub && cd tghub
cp apps/api/.env.example .env.production
```

Edit `.env.production`. Required:

| Variable | What to put |
| --- | --- |
| `DOMAIN` | `tghub.tn` — used by Compose and Caddy |
| `JWT_ACCESS_SECRET` | 64 random characters: `openssl rand -base64 48` |
| `SMTP_URL` | `smtps://user:password@smtp.provider.com:465` — sign-up codes and password resets can't work without it (the API refuses to start in production without it) |
| `MAIL_FROM` | `TG Hub <no-reply@tghub.tn>` — the domain must be verified with your mail provider (SPF/DKIM) |

Compose sets `NODE_ENV`, `MONGO_URI`, `PUBLIC_WEB_URL`, `CORS_ORIGINS`, `COOKIE_SECURE` and `TRUST_PROXY` for you.

Optional features switch on as soon as their keys are present:

| Feature | Variables | Notes |
| --- | --- | --- |
| Phone & desktop notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Generate once: `npx web-push generate-vapid-keys`. Never change them afterwards — existing subscriptions are tied to the key. |
| Sign in with Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord Developer Portal → OAuth2 → add redirect `https://DOMAIN/api/v1/auth/discord/callback` |
| Discord bot (`/tgh`) | `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` | Set **Interactions Endpoint URL** to `https://DOMAIN/api/v1/discord/interactions`, then register the command (step 4) |
| Steam library sync | `STEAM_API_KEY` | <https://steamcommunity.com/dev/apikey>. Linking Steam works without it. |
| Featured listings (Flouci) | `FLOUCI_PUBLIC_KEY`, `FLOUCI_PRIVATE_KEY` | Flouci webhooks are signed and checked; every payment is re-verified with Flouci before a listing is featured. Use the TEST APP keys first. |
| Featured listings (Konnect) | `KONNECT_API_KEY`, `KONNECT_WALLET_ID`, `KONNECT_SANDBOX=false` | Konnect's callback is unsigned, so the API always re-checks the payment with Konnect. |
| Tournaments from start.gg / FACEIT | `START_GG_TOKEN`, `FACEIT_API_KEY` | |

`PAYMENT_PROVIDER` can force `flouci` or `konnect`; empty picks whichever has keys. The local test checkout never runs in production.

## 3. Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps        # all services "healthy"/"running"
curl -s https://$DOMAIN/api/v1/push/config          # API reachable through the site
```

## 4. First admin and the Discord command

Sign up on the site with your own email, confirm the code, then:

```bash
docker compose -f docker-compose.prod.yml exec api node dist/scripts/promote-admin.js you@example.com
docker compose -f docker-compose.prod.yml exec api node dist/scripts/register-discord-commands.js   # only if the bot is configured
```

Never run the seed in production — it wipes the database (it refuses to when `NODE_ENV=production`).

## 5. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Media and data live in Docker volumes and survive rebuilds. CI (`.github/workflows/ci.yml`) typechecks, tests and builds every push, and builds both Docker images on `main`.

## 6. Backups and restore

The `backup` service dumps MongoDB and archives uploaded media into `./backups/<timestamp>/` at start-up and every day around 03:00 UTC, checks the dump is readable, and keeps 14 days.

Copy them off the server — a backup on the same disk doesn't survive losing the disk. For example with [rclone](https://rclone.org) to any S3-compatible storage, from the host's crontab:

```cron
30 3 * * * rclone sync /home/deploy/tghub/backups remote:tghub-backups
```

Restore (replaces the current database):

```bash
B=backups/20261024-030000
docker compose -f docker-compose.prod.yml exec -T mongo mongorestore --archive --gzip --drop < $B/mongo.archive.gz
docker compose -f docker-compose.prod.yml run --rm -v "$PWD/$B:/restore" api sh -c "cd /data && tar -xzf /restore/media.tar.gz"
```

Test a restore on a spare machine now and then; it's the only proof the backups work.

## 7. Monitoring

- **Errors:** crashes from the API (any 5xx, unhandled rejections) and from players' browsers land in **Admin → Errors**, grouped by cause, with how many players hit each. Resolve them there; one that comes back reopens itself.
- **Uptime:** point a free uptime checker (UptimeRobot, Better Stack) at `https://DOMAIN/` and `https://DOMAIN/api/v1/push/config`.
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f api` (JSON lines from pino).
- **Payments:** **Admin → Payments** lists every order with its provider reference; pending orders are re-checked every 5 minutes.

## 8. Scaling notes

- The live stream (chat, notifications) is held in the API process. One API container serves thousands of connected players; running several API containers needs the hub in `apps/api/src/core/realtime/hub.ts` moved onto Redis pub/sub.
- Uploaded images use local disk (`MEDIA_DIR`). Moving to object storage means another implementation of `apps/api/src/core/storage/storage.ts`.
- MongoDB in a single container is fine to start; MongoDB Atlas (or a replica set) when you need failover.
