# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Sổ Chi: a Vietnamese personal expense tracker (Next.js 16 App Router, React 19, HeroUI v3, Tailwind 4, Postgres + Drizzle, better-auth with Google). A Zalo bot lets linked users log expenses by text message or receipt photo. AI parsing goes through the **OpenAI** SDK (`src/server/ai/`, model in `src/server/ai/config.ts`), even though older docs say "Claude API". Receipt images are stored in Cloudflare R2. Design specs and phase plans are in `docs/superpowers/`, and Zalo Bot API notes are in `docs/zalo/bot.md`.

## Commands

Use pnpm (never npm or yarn).

```bash
docker compose up -d --wait   # Postgres on localhost:5433; creates DBs expense and expense_test
pnpm db:migrate               # apply migrations (reads DATABASE_URL from .env.local)
pnpm dev

pnpm test                     # unit + DB tests (DB tests need the Docker Postgres)
pnpm test:unit                # unit only, no DB
pnpm vitest run src/lib/parse-quick.test.ts      # single file
pnpm vitest run -t "name of test"                # single test by name
pnpm vitest run --project db src/server/services/transactions.db.test.ts

pnpm lint / pnpm lint:fix     # oxlint (not ESLint)
pnpm format / format:check    # oxfmt (not Prettier)
pnpm typecheck                # next typegen && tsc --noEmit
pnpm db:generate              # create a migration after editing src/server/db/schema/*
pnpm admin:grant <email>      # grant admin role (and unblock the user)
pnpm tunnel && pnpm zalo:webhook   # dev HTTPS tunnel (ngrok, DEV_TUNNEL_HOST) + register Zalo webhook
```

CI (`.github/workflows/ci.yml`) runs format:check, lint, typecheck, test and build. Commits must follow Conventional Commits (commitlint via husky), and lint-staged runs oxlint and oxfmt on staged files. A Claude PostToolUse hook already lints and formats each file you edit.

## Tests

- `*.test.ts` files belong to the `unit` Vitest project. `*.db.test.ts` files belong to the `db` project, which runs migrations against `expense_test` once (`src/test/db-global-setup.ts`) and runs files serially. Use `resetDb()` / `createTestUser()` from `src/server/db/test-utils.ts`.
- `src/test/setup-env.ts` fills in dummy values for every required env var and points `DATABASE_URL` at the test DB (or `TEST_DATABASE_URL`). `server-only` is aliased to an empty module so server code can be imported in tests.

## Architecture

Layering, outside in:

- **`src/app/`**: routes. `(auth)` holds `/login`. `(main)` holds the authenticated pages; each page calls `requireSession()` / `requireAdmin()` and then calls services directly. `api/` holds better-auth, the Zalo webhook, receipt image proxy, and the cron cleanup (scheduled in `vercel.json`, authorized by `CRON_SECRET`).
- **`src/proxy.ts`**: Next 16's replacement for middleware. It only checks that a session cookie is present. Real auth happens in `requireSession()`. New public paths (webhooks, metadata files) must be added to `isPublicPath`.
- **`src/features/<feature>/`**: client UI plus `actions.ts` (`'use server'`). Actions are built with `defineAction` / `defineAdminAction` from `src/server/action.ts`. These wrappers resolve the session, validate input with Zod, call a service, run `refresh()`, and return `ActionResult<T>` (`{ok:true,data} | {ok:false,error}`). Services throw `ServiceError(code)` (`src/server/services/errors.ts`), and the code becomes the action's `error`. The UI maps error codes to i18n messages. To add an error code, extend `ServiceErrorCode`.
- **`src/server/services/`**: all DB access and business logic. **Every service function takes `userId` first and must scope its queries by it.** `data-isolation.db.test.ts` checks this. Transactions are soft-deleted.
- **`src/server/zalo/`**: the webhook (`app/api/zalo/webhook/route.ts`) checks the secret header in constant time, dedupes on `messageId`, acks right away, and handles the update inside `after()`. `handler.ts` classifies the update as link, undo, text, or image and replies through the Zalo client. Users link accounts with a one-time code from Settings (`/link <code>`).
- **Smart entry** (`services/smart-entry.ts`): `parseQuick` (`src/lib/parse-quick.ts`, a deterministic Vietnamese parser such as "ăn phở 45k") runs first. AI is called only when confidence is low, and only to pick the category, store, and note; amount and date always come from `parseQuick`. Receipts always use AI. Each AI call is metered per user per day by `consumeAiCall` (`AI_DAILY_LIMIT`; admins are not limited).
- **Auth** (`src/server/auth/`): better-auth with a Drizzle adapter. Sign-up is open. `hooks.ts` rejects blocked users and seeds default categories in the user's locale. `role` is `user | admin`. A blocked user's session row is deleted instead of having its cookie cleared, because Server Components cannot clear cookies.
- **Env**: always read through `env()` in `src/configs/env.ts`, which validates lazily with Zod so `next build` works without secrets. Never read `process.env` directly in app code.
- **Dates**: the app's "today" is Vietnam time (`todayVn()` in `src/lib/dates.ts`, `Asia/Ho_Chi_Minh`). Pass `today` / `now` into services instead of calling `new Date()` inside them, so tests stay deterministic.
- **i18n**: next-intl without locale routing. The locale comes from a cookie (`src/i18n/request.ts`), and messages live in `messages/vi.json` (default) and `messages/en.json`. Add every new string to both files.
- **Styling**: Tailwind 4 is configured in CSS (`src/app/globals.css`, with tokens in `src/app/styles/tokens/`), so there is no `tailwind.config.js`. Check the HeroUI v3 docs index in AGENTS.md before using any HeroUI component.
- Path alias: `@/` → `src/`.

## Code style

- Do not write comments that just restate what the code does. Only add a comment when the WHY isn't obvious from the code itself (a non-obvious constraint, workaround, or invariant).
- oxlint enforces `consistent-type-imports` and allows only `console.warn/error/info`.
