# Code rules

TG Hub is proprietary software owned by Defendr.gg (see [LICENSE](../LICENSE)). These are
the rules every change follows. Most are enforced by tools; the rest are checked in review.

```bash
npm run check
```

runs ESLint (`--max-warnings 0`), `tsc` in every workspace and the tests. CI runs the same
steps plus the production build, and a change that fails any of them does not merge.

## Enforced by the tools

**TypeScript** ([tsconfig.base.json](../tsconfig.base.json)) — `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, no unreachable code.

**ESLint** ([eslint.config.mjs](../eslint.config.mjs)) — typescript-eslint `strict` plus type-aware rules:

| Rule | Why |
| --- | --- |
| No floating or misused promises | An un-awaited promise in an Express handler or a click handler fails silently. Mark fire-and-forget calls with `void`. |
| Exhaustive `switch` on unions | Adding a status, role or event type must fail the build where it isn't handled yet. |
| No `any`, no enums | Unions come from `as const` arrays in `packages/shared`, so the API, the web app and Zod share one list. |
| `import type` for types | Keeps server-only types out of client bundles. |
| `eqeqeq` (null checks excepted), no implicit coercion, `prefer-const` | Fewer surprises when reading code. |
| No `console` outside `apps/api/src/scripts` and the seed | The API logs through pino; browser crashes are reported to Admin → Errors. |
| No `dangerouslySetInnerHTML` | Everything players write is shown as text. |
| React hooks, including the React Compiler rules | No `setState` inside effects: derive the value, adjust it during render, use `useEffectEvent` for "latest value" reads and `useSyncExternalStore` for browser-only values. |
| Import boundaries | `packages/shared` imports neither app; the web app reaches the API over HTTP only (`src/lib/api`); the API never imports React or Next; settings are read through `apps/api/src/config/env.ts`. |

A rule may be switched off for one line only, with the reason after `--`:

```ts
// eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after hydration.
```

A disable comment that no longer suppresses anything is itself an error.

## Checked in review

**API**
- Every request body, query and param is parsed with a Zod schema from `packages/shared`, through `handle()`. Failures are thrown as `AppError` with a stable code.
- Admin routes sit behind `requireRole('admin')`; moderators only reach what `canOpen` in the admin nav allows.
- XP only moves through the ledger (`awardXp`, and the admin adjustment helpers) with an idempotency key — never by editing a user's totals.
- Cross-module reactions go through the domain event bus, not direct imports between modules.
- New logic in `core/` or a module service comes with a `node:test` test.

**Web**
- Server components fetch with `serverApi` / `serverApiOr` (or `viewerApi` when the page depends on who is signed in); client components use TanStack Query with keys from `src/lib/query-keys.ts`.
- Every visible string is in the three dictionaries (`en`, `fr`, `ar`). `fr` and `ar` are typed against `en`, so a missing translation is a build error. The admin console stays in English.
- Layout uses logical CSS properties (`margin-inline-start`, `inset-inline`) so Arabic mirrors without extra rules. Colours come from the theme tokens and work in light and dark.
- Links that leave the site open in a new tab with `rel="noopener"`.

**Secrets and storage**
- Secrets live only in the git-ignored `apps/api/.env` and on the server — never in code, fixtures, logs or screenshots.
- The R2 bucket is shared with Defendr: TG Hub reads and writes only under its `tg-hub/` prefix.
- Code under another license is not pasted into the repository. New dependencies are added at an exact version that has been out for at least two weeks.

**Credits**
- The "Powered by Defendr.gg" credit stays in the site footer, on the home page and in the admin console.
