# TG Hub — Tunisian Gaming Hub

Discover. Compete. Trade. A gaming platform for Tunisia first: one Radar for news,
patch notes, deals and events; tournaments mirrored from start.gg and FACEIT with
reminders; a player-to-player marketplace for gear and FiveM / game-mod assets with
live chat, ratings and featured listings; clans, a teammate finder and a follow feed;
a PC Lab that checks your rig against each game's published requirements; a Universe of
XP, missions, achievements and a community Pulse; and alerts that reach the inbox, the
phone and Discord. English, French and Arabic (right-to-left), light and dark themes.

Architecture, conventions and the phase plan: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Going live on a server: [DEPLOY.md](DEPLOY.md).

## Stack

| | |
| --- | --- |
| `apps/web` | Next.js 16 (App Router, React 19), TanStack Query, CSS Modules — no UI kit |
| `apps/api` | Express 5 + TypeScript, Mongoose 9, Zod 4, `jose` JWTs, pino, `sharp` + `multer` for image uploads |
| `packages/shared` | Zod request schemas, response DTOs, enums, level curve — imported by both apps |
| Database | MongoDB 7+ |

## Run it locally

Requirements: Node 20.19+ and a MongoDB on `mongodb://127.0.0.1:27017` (or set `MONGO_URI`).

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

Set `JWT_ACCESS_SECRET` in `apps/api/.env` to a long random string (the example file shows a one-liner to generate one). Then:

```bash
npm run seed
```

```bash
npm run dev
```

- Web: http://localhost:3000 (proxies `/api/v1/*` to the API, so cookies stay first-party)
- API: http://localhost:4000 — health check at `/health`

The seed **drops and rebuilds** the configured database (it refuses to run with `NODE_ENV=production`).
It creates the catalogue, a CPU/GPU performance index, Season 1, missions and achievements,
an admin account and twelve demo players, 27 marketplace listings (product shots drawn as
SVG and pushed through the real upload pipeline), a few buyer–seller chats and one flagged
listing for the moderation queue, then pulls live announcements from Steam's official news API.
Uploaded images are written to `apps/api/var/media` (`MEDIA_DIR`), which the seed clears. Run it offline with `SEED_FETCH_FEEDS=false`. Dev account usernames
and passwords are defined in `apps/api/src/seed/index.ts` (overridable via `SEED_*` vars in `.env`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) and web (next dev) together |
| `npm run seed` | Reset the dev database with seed data |
| `npm test` | Unit tests (node:test) — compatibility engine, level curve, Steam parser, tournament mappers, listing rules, image processing, one-time codes, push endpoint allowlist, Discord signatures, Steam OpenID + OAuth state, payment gateways and Flouci webhook signatures, saved-search naming, error grouping |
| `npm run typecheck` | `tsc` across all workspaces (web runs `next typegen` first) |
| `npm run build` | API bundle (tsup) + Next.js production build (standalone server) |
| `npm run admin:promote -w apps/api -- you@example.com` | Make an existing account an admin |
| `npm run discord:register -w apps/api` | Register the `/tgh` slash command (needs the Discord bot keys) |

## What's built

- **Accounts** — register/login by email or username, httpOnly cookie sessions for the web, Bearer + body refresh tokens for native apps, rotating refresh tokens with reuse detection, rate-limited auth, CSRF header check. New accounts confirm their email with a 6-digit code (15-minute expiry, 5 tries, 60 s resend cooldown, daily cap, stored only as a keyed hash); until then a banner reminds them and marketplace actions are refused with `EMAIL_NOT_VERIFIED`. Accounts created before verification existed count as verified. Profiles carry a country (any ISO country) and, for players in Tunisia, a governorate; the Universe standings switch between governorates and countries.
- **Account security** — forgot / reset password by emailed code, change password (signs out other devices), change email with a code sent to the new address, a list of signed-in devices with "sign out" per device or all others. Profile picture and cover upload with a crop-and-position dialog (cut in the browser, re-encoded server-side, EXIF stripped).
- **Notifications** — a Facebook-style bell dropdown (All / Unread, New vs Earlier, mark all as read, red unread count) next to the full inbox page, plus a level-up celebration popup whenever a player's level rises.
- **Real time** — one server-sent-event stream per tab: new notifications and chat messages arrive instantly with a pop-up card, chats show "typing…" and "Seen". Players away from the site get **web push** on desktop and Android (iPhone once TG Hub is added to the Home Screen) through a service worker; push goes only to signed-in devices and only when the player isn't on the site.
- **Squads** — **clans** with a tag, colour, games and recruiting policy (open / apply / closed), leader / officer / member roles, applications, transfers, and a season-XP clan leaderboard; a **teammate finder** where players post what they want to play (game, platform, rank, slots, voice languages, mic) and accept who joins — contact details are revealed only to accepted players.
- **Follows & feed** — follow players; a feed of level-ups, achievements, new listings, clan moves, squad posts and favourite games from people you follow, with "GG" reactions, follower lists, suggestions and a setting to keep your activity private.
- **Connected accounts** — sign in or link with **Discord** (OAuth2, never auto-attached to an existing email), link **Steam** (OpenID, verified with Steam) and show the catalogue games you own. A **Discord bot** (`/tgh profile | clan | lfg | top | link`) answers over signed HTTP interactions.
- **Radar** — searchable feed of news, patch notes, guides, deals (expiry countdowns) and events (calendar); game nicknames work (`cs2`, `lol`, `pes`).
- **Games** — catalogue with platform/genre/price filters in the URL, game pages with published requirements, favourites, tournaments and "on the Radar".
- **Tournaments (consumed, never created)** — mirrored from start.gg (GraphQL) and FACEIT (Data API v4) via discovery sources or import-by-URL; status derived from dates so "open → live → results" stays right between syncs; "Remind me" sends inbox reminders 24 h before sign-ups close and 1 h before start; new Tunisian events alert everyone, others only that game's followers. Sign-up always links out to the organizer's platform.
- **Marketplace** — Facebook-Marketplace-style buying and selling between players: category sidebar (FiveM & RP assets, mods, PCs, parts, consoles, peripherals, setup, games), filters for governorate, price, condition, FiveM framework and delivery, full-text search, sort by newest or price. Listings carry up to 10 photos (re-encoded to WebP, EXIF and GPS stripped, square thumbnails), physical details (condition, governorate, meet-up / delivery) or digital details (framework, Keymaster / Tebex / download, open or escrowed source, rights confirmation). Buyers message sellers in per-listing threads with unread counts in the header; sellers mark items pending/sold, renew once a day, edit or delete. Saved items reuse bookmarks. **Saved searches** alert you when a new listing matches. When marking an item sold the seller picks the buyer from the chats, who can then **rate** the sale (1–5 stars, editable for 14 days, one seller reply); sellers with confirmed sales and strong ratings earn a **verified seller** badge (moderators can pin it either way). Sellers can pay to **feature** a listing (Featured badge and the row at the top) through **Flouci** or **Konnect**; payments are always re-verified with the provider, and a test checkout stands in during development. Reports flag a listing after 3 distinct reporters; moderators remove (the seller gets an inbox alert with the reason) or restore. Prices are whole TND; TG Hub never holds money for a sale between players.
- **PC Lab** — component search over the hardware index, saved rigs (up to 5), verdict per part with headroom and bottleneck, upgrade pointers, "what this rig runs". Missing benchmark data yields "No data", never a guess.
- **Universe** — XP ledger with idempotency keys, levels and titles, daily/weekly/season missions with claims, achievements with rarity, the Pulse with milestone announcements, season leaderboard and region standings.
- **Alerts** — inbox with read/unread and cursor paging, per-category preferences, followed games (favourites follow automatically), daily cap, dedup keys, delivery logs, Steam News sources with health checks and auto-disable, Discord webhook channel.
- **Admin dashboard** (`/admin`) — its own full-screen shell (dark sidebar, top bar, no public header/footer) with one route per section. Overview shows what needs a decision (flagged listings, failing sources), KPI tiles with change vs the previous period and sparklines, daily community activity (with a table view), listings by category, XP per day, newest players and listings, for the last 7 / 30 / 90 days in Tunis time. Sections: marketplace moderation, players (roles, suspension, seller badge, removing offensive photos), payments, missions & XP, Radar content, tournaments (platforms, sources, import, moderation with a start.gg game-ID lookup), announcements, alert sources, Discord channels, and **errors** — crashes from the API and players' browsers grouped by cause. Moderators see only the marketplace queue.
- **Languages** — English, French and Arabic, picked from the footer, the mobile menu or Settings (or the browser's language). Arabic switches the whole layout to right-to-left with the Cairo typeface; CSS uses logical properties so every page mirrors. The admin console stays in English.
- **Design** — tournament-platform styling (Montserrat / Roboto / Teko numerals, white or charcoal cards, one bright action blue, gold for prizes and XP, Tunisian red kept for the brand mark and live states). Light and dark themes follow the OS until the player picks one; the choice is applied before first paint.

## Before launch

See [DEPLOY.md](DEPLOY.md) for the server, Docker, HTTPS, backups and monitoring. Still to decide or finish:

- **Translations** cover the site frame, sign-in, home, marketplace browsing, squads, feed and settings. Deeper screens (listing pages and forms, PC Lab, tournaments, Universe, alerts) and content coming from the API (category descriptions, condition names, notification texts) are still English — add their strings to `apps/web/src/i18n/dictionaries`.
- **Payments:** featured listings are ready for Flouci and Konnect but haven't been run against their live APIs; do a sandbox payment with each provider's test keys first. Escrow / payment protection for sales between players needs a licensed partner and is not built.
- **Discord and Steam** sign-in/linking and the bot are implemented and unit-tested but need real credentials to try end to end.

- **Seed content is for development.** Re-verify every system-requirement tier against the official store page; replace the sample deals, events and guides with real ones.
- **Hardware scores** are a relative index for comparing parts, not FPS predictions. TND prices stay empty until there is a dated local source.
- **Tournament platforms:** set `START_GG_TOKEN` (start.gg developer token) and `FACEIT_API_KEY` (FACEIT server-side Data API key). Until then only the clearly-labelled sample tournaments show. The adapters follow each platform's published schema and are unit-tested against fixtures, but haven't been run against the live APIs yet — do one import per platform in Admin → Tournaments after adding the keys. Challonge is not supported yet (its v1 docs now redirect to v2.1 and free apps are capped at 500 requests/month).
- **Marketplace media** lives on local disk (`MEDIA_DIR`). For more than one API instance, add an S3/R2 driver behind `core/storage/storage.ts` (three methods) and serve files from a CDN.
- **Marketplace rules:** publish terms (prohibited items, no account selling, no leaked FiveM assets) before opening it publicly.
- **Email:** set `SMTP_URL` (any SMTP provider — Brevo, Mailgun, SES…) and `MAIL_FROM`. Without SMTP in development the code is written to the API log and shown on the verify page; the API refuses to start in production without it.
- Set `COOKIE_SECURE=true`, a strong `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, and `INGESTION_ENABLED=true` in production; serve both apps behind HTTPS.
