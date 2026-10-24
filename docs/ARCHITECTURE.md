# TG Hub — Architecture

One backend, many clients. The website ships first; the Android app and the
Discord bot plug into the same API, the same contracts and the same alert rules.

```
                 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                 │  apps/web    │   │ Android app  │   │ Discord      │
                 │  Next.js 16  │   │ (phase 8)    │   │ webhooks/bot │
                 └──────┬───────┘   └──────┬───────┘   └──────▲───────┘
         cookies via    │  Bearer token    │                  │ alert channel
         /api/v1 proxy  ▼                  ▼                  │
                 ┌─────────────────────────────────────────────┴──────┐
                 │ apps/api — Express 5, modular monolith             │
                 │  auth · users · games · radar · library · hardware │
                 │  tournaments (start.gg / FACEIT adapters)          │
                 │  market (listings, chats, reports) · media         │
                 │  progression (XP, missions, achievements, pulse)   │
                 │  alerts (inbox, prefs, sources, channels) · admin  │
                 │            ▲ in-process domain event bus ▲          │
                 └──────────────────────┬─────────────────────────────┘
                                        ▼
                                   MongoDB
       packages/shared — Zod schemas, DTO types, constants, level curve
```

## Repository layout

| Path | What lives there |
| --- | --- |
| `packages/shared` | Request schemas (Zod), response DTOs, enums, the XP/level curve. Imported as TypeScript source by every app — one contract, no drift. |
| `apps/api` | HTTP API under `/api/v1`. One folder per module. |
| `apps/web` | Next.js App Router site. Feature folders + a small hand-built UI kit (CSS Modules, no UI framework). |
| `docs` | This file and future ADRs. |

## API design

**Module anatomy** — every module owns its models, service and routes:

```
modules/games/
  game.model.ts      persistence (Mongoose schema + indexes)
  games.mapper.ts    document → DTO (the only place DB shape meets API shape)
  games.service.ts   business rules, no req/res
  games.routes.ts    HTTP: validation + auth guards + calling the service
```

Modules talk to each other in two ways only: calling another module's
*service*, or emitting a *domain event* (`core/events`). Progression never gets
called by the games module — it listens for `game.viewed`. That keeps features
independent and lets the bus be swapped for a queue (BullMQ / Redis Streams)
when traffic demands it, without touching the emitters.

**Conventions**

- Success: `{ "data": ... }`. Errors: `{ "error": { "code", "message", "details?" } }`.
- Every input is parsed by a Zod schema from `@tgh/shared` inside `handle()` — handlers receive typed, validated `body / query / params`.
- Offset pagination for catalogues (`Page<T>`), cursor pagination for feeds that grow forever (`CursorPage<T>` on the inbox).
- Mutating requests that authenticate by cookie must send `X-TGH-CSRF: 1` (custom header ⇒ CORS preflight ⇒ no cross-site forgery).

**Auth**

- Short-lived access JWT (15 min, HS256 via `jose`) + opaque refresh token (30 days) stored *hashed* in `sessions` with a TTL index.
- Web: both tokens in `httpOnly` cookies, browser talks to the API through the Next.js `/api/v1` rewrite, so everything is same-origin.
- Mobile: send `X-Client-Type: native` to receive the refresh token in the body; use `Authorization: Bearer`.
- Refresh tokens rotate on every use. Re-using an old one after a 60 s grace window revokes the session (stolen-token detection).
- A readable `tgh_session=1` hint cookie (no secret) lets the web app skip the `/me` probe for guests.
- Passwords: `scrypt` from `node:crypto`, no native addons.

**Server-validated rewards**

- `xp_ledger` is the source of truth; each grant carries a unique `idempotencyKey` (`mission:<id>:<period>`, `ach:<code>`). Double-submits and retries can't double-pay.
- `users.xp/level` and `season_stats` are caches updated with `$inc` after the ledger insert.
- Mission progress is driven only by server-side events (unique game views per day, saved specs, compatibility checks…), never by the client.
- The Pulse uses an atomic `$inc` that returns the pre-image, so each milestone is crossed — and announced — exactly once.

**Alerts pipeline**

```
source adapter (Steam News API, admin composer, internal events)
   → alerts.publish()  — unique dedupKey: the same announcement is stored once
   → channels: inbox (fan-out by preferences + daily cap) · push (players away from the site) · discord (webhooks)
   → delivery_logs     — one row per channel per alert, visible in admin
```

Sources track health (`lastSuccessAt`, `consecutiveFailures`) and auto-disable
after 5 failures; admins can re-enable, run on demand, or send a test alert.
Broadcasts carry an `audience`: everyone with the category on, or only followers
of the alert's game.

**Tournaments — consumed, never created**

```
TournamentProviderAdapter (startgg · faceit)  → ExternalTournament (provider-agnostic)
   discovery sources (game + country/region) ┐
   admin import by URL                       ├→ upsert on (provider, externalId) → announce once
   refresh job for active tournaments        ┘
status = deriveStatus(providerState, dates, registration)   — never stored
follows = reminder subscriptions → personal alerts (sign-ups close in 24 h, start in 1 h)
```

The mirror overwrites synced fields only; moderation (`hidden`, `featured`, an
admin-set game) survives every sync. Adding Challonge/Toornament = one more adapter.
Background work (Steam sources, tournament discovery/refresh, reminders, media
cleanup) runs through `core/ingest/jobs.ts`; move it to a single worker when the
API scales out.

**Marketplace — players sell to players, TG Hub never holds money**

```
POST /media            multipart → sharp (auto-orient, strip EXIF/GPS, 1600px WebP + 480px square thumb)
                       → ObjectStorage (local disk today; S3/R2 driver later) → Media doc (orphanSince = now)
POST /market/listings  photoIds must be the seller's own, unattached uploads → attach (orphanSince = null)
GET  /market/listings  status in {active, pending} + facets (category, sub, governorate, condition,
                       framework, price, delivery) + $text search; indexes lead with status
POST /market/listings/:id/messages   buyer opens or continues the (listing, buyer) thread
conversations          per-side unread counters → header badge is one indexed count
reports                one per player; 3 distinct reports flag the listing for moderators
```

Images are served from `GET /api/v1/media/:file` ahead of the API limiter, with
immutable caching (ids never repeat). Unreferenced uploads are deleted after 24 h.
Digital listings (FiveM, mods) carry framework / delivery / source and a rights
confirmation; physical ones carry condition, governorate and hand-over options —
one Zod schema validates both, with field paths the form maps straight onto inputs.
Domain events `market.conversation_started` and `market.listing_removed` become
personal inbox alerts for the seller.

**Real time** — `GET /stream` is a server-sent-event stream per signed-in tab
(`core/realtime/hub.ts`, in-process; Redis pub/sub when the API scales out).
It only nudges: every event's data is also reachable through normal endpoints,
so a dropped connection loses nothing. The stream ends when the access token
expires; the web client refreshes and reconnects with backoff. Web push
(`modules/push`, VAPID) reaches players with no open stream; subscriptions are
tied to the session that created them and endpoints must belong to a known
browser push service.

**Squads, social, connections** — clans keep a denormalised `xp`/`seasonXp`,
updated on every `progression.xp_awarded` event and recomputed by a job (season
rollovers). The activity feed is written only by event listeners
(`modules/social/social.listeners.ts`) with dedup keys, so replays and toggles
record once. Discord OAuth and Steam OpenID share a signed, single-use state
cookie (`connections/oauth-state.ts`); a Discord identity is never auto-merged
into an existing account by email. Bot interactions are verified with Ed25519
over the raw body.

**Payments** — `modules/payments/gateways.ts` puts Flouci, Konnect and a
development checkout behind one interface: start a checkout, and ask for the
real status. Redirects and webhooks only trigger a status check; an order flips
`pending → paid` with a conditional update (so a webhook and a redirect can't
both apply it) and only when the provider confirms the exact amount.

**Monitoring** — 5xx errors, unhandled rejections and browser crashes are
grouped by fingerprint (normalised message + first own stack frame) in
`error_events`; a resolved error that recurs reopens itself.

## Web design

- App Router. Public pages (home, radar, catalogue, game pages, profiles) are **server components** fetching the API directly — fast and indexable.
- Interactive surfaces (PC Lab, missions, inbox, admin) are client components on TanStack Query, with one fetch wrapper that refreshes the session transparently on 401.
- Route groups split the two frames: `app/(site)` wraps every public page in the header/ticker/footer; `app/admin` has its own dashboard shell (sidebar nav driven by `features/admin/nav.ts`, which also holds each section's allowed roles). The root layout only sets fonts, theme and providers. The API still enforces roles on every request — the shell only decides what to show.
- Dashboard charts are hand-drawn SVG (`features/admin/charts.tsx`): one axis per chart, 2px lines, capped columns with rounded data-ends, a crosshair tooltip, keyboard stepping and a table view. Series colours are validated per theme for colour-blind separation and contrast. Daily series come from `GET /admin/stats?days=7|30|90`, aggregated in Tunis time and compared with the previous window.
- Filters live in the URL (`/games?genre=fps&platform=pc`) so every view is shareable.
- Visual identity: tournament-platform styling — Montserrat headings and UI, Roboto body, Teko scoreboard numerals; white (light) or charcoal (dark) cards on a grey ground; one bright blue for every action, gold for prizes/XP/levels, green for good news, Tunisian red only for the brand mark, live states and destructive actions. Typographic game tiles on each game's own colour; marketplace grids lead with square photos and the price.
- Languages: `src/i18n` holds one typed dictionary per language (French and Arabic must match the English shape, so a missing string is a build error). The root layout reads the `tgh_locale` cookie (or `Accept-Language`), sets `<html lang dir>`, and server components call `getT()` while client components use `useT()`. Stylesheets use logical properties (`margin-inline-start`, `inset-inline-end`…) and directional icons flip under `dir="rtl"`.
- Theming: all colours are role tokens in `app/globals.css` (`--surface`, `--text-2`, `--primary`, `--gold-text`…) redefined under `[data-theme='dark']`. A `beforeInteractive` script applies the stored choice (or the OS preference) before first paint; components never reference raw colours.

## Testing

`npm test` runs `node:test` suites for the pure logic that decides outcomes: the
compatibility engine (`modules/hardware/compatibility.ts`), the level curve
(`packages/shared/src/progression.ts`), the Steam BBCode cleaner, the listing
rules (`packages/shared/src/market.test.ts`), the upload pipeline (EXIF/GPS
stripping, resizing, rejecting non-images), and the security-critical edges:
one-time codes, the push-endpoint allowlist, Discord Ed25519 signatures (with a
real HTTP round trip), Steam OpenID verification, OAuth state, payment status
mapping and Flouci webhook signatures. Next up:
integration tests for auth rotation, mission claims and alert fan-out against an
in-memory MongoDB.

## Build phases

| Phase | Status |
| --- | --- |
| 1 Stabilize & redesign | Done — new monorepo, responsive shell |
| 2 Radar & PC tools | Done — catalogue, resources, search, PC Lab, saved rigs |
| 3 Accounts & shared backend | Done — auth, sessions, profiles, shared contracts |
| 4 Universe | Done — XP, levels, titles, missions, achievements, Pulse, season + region standings |
| 5 Alerts MVP | Done — inbox, preferences, dedup, Steam source, delivery logs, admin |
| 6 Discord | Done — webhook channels, Discord sign-in and linking, `/tgh` bot over HTTP interactions |
| 7 Community & competition | Done — tournaments (consumed), clans + season standings, teammate finder, follows + feed, live chat. Next: duels |
| 8 Android app | Uses this API as-is (Bearer auth path) — web push already reaches Android browsers |
| 9 Business | Marketplace done — listings, photos, live chat, saved searches, ratings + verified sellers, featured listings via Flouci / Konnect. Next: escrow through a licensed partner |
| 10 Going live | Done — Docker images, compose stack with Caddy HTTPS, CI, nightly backups, error monitoring, English / French / Arabic |

## Scaling notes

- Stateless API → run N instances behind a load balancer; sessions live in Mongo.
- Move the event bus and alert fan-out to a queue worker when one process can't keep up; the `AlertChannel` interface already isolates delivery.
- Catalogue search uses indexed prefix/contains on normalized fields + aliases (`cs2`, `lol`). Switch to Atlas Search when the catalogue grows past tens of thousands.
- Inbox notifications expire after 90 days (TTL index).
- Marketplace chats are live over the event stream; polling only kicks in while the stream is down. Several API instances need the realtime hub on Redis pub/sub.
- Transactions are not required (ledger-first + idempotency); enable a replica set later for multi-document transactions where needed.
