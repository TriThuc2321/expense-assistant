# Sổ Chi — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in, allowlisted user lands in the Sổ Chi app shell (sidebar ≥900px, bottom tab bar <900px, light/dark, vi/en) with default categories seeded in Postgres; anyone else is blocked at login.

**Architecture:** Next.js 16 App Router. Drizzle + postgres-js for the DB, better-auth (Google only) with database hooks enforcing the allowlist and seeding categories. `src/proxy.ts` does an optimistic cookie check; `(main)/layout.tsx` does the real session check. HeroUI v3 is re-themed by overriding its CSS variables with TH tokens.

**Tech Stack:** Next 16.4, React 19.3, HeroUI v3.2, Tailwind 4, Drizzle 0.45 + drizzle-kit, postgres 3.4, better-auth 1.7.15, next-intl 4, next-themes, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-so-chi-mvp-design.md` (Phase 1 = §12 "Phase 1: Nền tảng"). UI source of truth: `docs/design_handoff_so_chi/README.md` + `design/So Chi.dc.html` (local only, not committed).

## Global Constraints

- Read before coding: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `.../02-guides/authentication.md`, `.../01-getting-started/13-fonts.md`. `middleware.ts` is now `proxy.ts` (export `proxy`).
- `.heroui-docs/` is missing: run `pnpm dlx heroui agents-md --react --output AGENTS.md` first (or use the `heroui-react` skill scripts). Read the relevant `.mdx` before using any HeroUI component; do not code HeroUI v3 from memory.
- Breakpoint: ≥900px = wide, else narrow.
- Icons: `lucide-react`, `strokeWidth={1.75}`. Google logo stays `react-icons` (`FcGoogle`).
- Fonts: Space Grotesk (UI 400/500/600) + IBM Plex Mono (money, overlines) via `next/font/google`, subsets `latin` + `vietnamese`. Remove Inter.
- Money: always VND, `"45.000 ₫"` in IBM Plex Mono, expense prefix `−` (U+2212), income `+` in success color, in both locales.
- All copy in `messages/vi.json` + `messages/en.json`; vi copy is verbatim from the handoff. Category names are user data, never translated.
- Brand name is "Sổ Chi" (replace "TH Expense" in metadata and `common.appName`).
- `env()` from `src/configs/env.ts` is the only reader of `process.env` in app code (except `next.config.ts`, `drizzle.config.ts`, test setup).
- Code style (CLAUDE.md): no comments that restate code; only non-obvious WHY.
- Commits: conventional commits (commitlint + husky are active).

## Review Focus

1. `ALLOWED_EMAILS` with stray spaces/case (`" Thuc@Gmail.com ,b@x.com"`) → `thuc@gmail.com` is allowed; empty entries never match an empty email. Pinned in Task 1.
2. An email removed from `ALLOWED_EMAILS` after the account exists → the next sign-in is blocked (`session.create.before`), not only first sign-up. Pinned in Task 4.
3. Category seeding interrupted or run twice (retry, two tabs logging in) → exactly 7 roots + 22 children, no duplicates, and a user whose first seed failed gets categories on next login. Pinned in Tasks 3 and 4.
4. First login with no/invalid `NEXT_LOCALE` cookie → Vietnamese category names. Pinned in Task 4.
5. Proxy must not redirect `/api/auth/*`, `/api/zalo/*` (Phase 3 webhook), `/_next/*`, or static files to `/login`, and must not loop on `/login`. Pinned in Task 4.

---

## File Structure

```
vitest.config.ts                     test projects: unit, db
drizzle.config.ts
src/test/setup-env.ts                dummy env for tests
src/test/empty.ts                    alias target for `server-only`
src/test/db-global-setup.ts          runs migrations on expense_test
src/server/db/index.ts               getDb()
src/server/db/schema/{auth,categories,transactions,index}.ts
src/server/db/migrations/            drizzle-kit output (committed)
src/server/db/test-utils.ts          resetDb(), createTestUser()
src/lib/categories-default.ts        DEFAULT_CATEGORIES
src/lib/format.ts                    formatVnd, formatSignedVnd
src/server/services/categories.ts    ensureDefaultCategories
src/server/auth/allowlist.ts         parseAllowedEmails, isEmailAllowed
src/server/auth/hooks.ts             createDatabaseHooks, localeFromCookieHeader
src/server/auth/index.ts             getAuth()
src/server/auth/session.ts           requireSession()
src/lib/auth-client.ts               authClient
src/proxy.ts                         proxy + isPublicPath
src/app/api/auth/[...all]/route.ts
src/app/styles/tokens/*.css          TH tokens copied from handoff
src/app/styles/index.css             HeroUI var overrides + @theme
src/components/ui/{money,responsive-sheet,toast}.tsx
src/hooks/use-is-wide.ts
src/features/shell/{nav.ts,sidebar.tsx,tab-bar.tsx,tx-sheet-host.tsx,logo-tile.tsx}
src/app/(main)/{layout,page}.tsx + transactions/ categories/ settings/ page.tsx
src/app/(auth)/{layout.tsx,login/page.tsx}
src/features/auth/google-button.tsx
```

---

### Task 1: Vitest harness + email allowlist

**Files:**

- Create: `vitest.config.ts`, `src/test/setup-env.ts`, `src/test/empty.ts`, `src/server/auth/allowlist.ts`, `src/server/auth/allowlist.test.ts`
- Modify: `package.json`, `src/configs/env.ts`, `.env.example`, `.github/workflows/ci.yml`

**Interfaces:**

- Produces: `parseAllowedEmails(raw: string): Set<string>`, `isEmailAllowed(email: string | null | undefined, allowed: Set<string>): boolean`; `env().ALLOWED_EMAILS: Set<string>`; scripts `pnpm test`, `pnpm test:unit`.

- [ ] **Step 1: Install and configure Vitest**

`pnpm add -D vitest`. `vitest.config.ts`: alias `@` → `./src`, `server-only` → `./src/test/empty.ts` (the real package throws outside the react-server condition); `test.setupFiles: ['./src/test/setup-env.ts']`; `test.projects`: `unit` (include `src/**/*.test.ts`, exclude `src/**/*.db.test.ts`, environment `node`) — the `db` project is added in Task 2. Scripts: `"test": "vitest run"`, `"test:unit": "vitest run --project unit"`.

`setup-env.ts` assigns a placeholder to every required key in `envSchema` only if unset (`APP_URL=http://localhost:3000`, 32-char `BETTER_AUTH_SECRET`, `ZALO_WEBHOOK_SECRET` ≥8 chars, `CRON_SECRET` ≥16 chars, `ALLOWED_EMAILS=test@example.com`, …) and sets `DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/expense_test'`.

- [ ] **Step 2: Write failing test `src/server/auth/allowlist.test.ts`**

```ts
describe('parseAllowedEmails', () => {
  it('trims, lowercases and drops empties', () => {
    expect(parseAllowedEmails(' Thuc@Gmail.com , b@x.com,, ')).toEqual(
      new Set(['thuc@gmail.com', 'b@x.com']),
    );
  });
});
describe('isEmailAllowed', () => {
  const allowed = parseAllowedEmails('thuc@gmail.com');
  it('matches case-insensitively', () =>
    expect(isEmailAllowed('THUC@gmail.com ', allowed)).toBe(true));
  it('rejects others', () =>
    expect(isEmailAllowed('x@gmail.com', allowed)).toBe(false));
  it('rejects empty/null', () => {
    expect(isEmailAllowed('', parseAllowedEmails(','))).toBe(false);
    expect(isEmailAllowed(null, allowed)).toBe(false);
  });
});
```

- [ ] **Step 3: Run** `pnpm test:unit` → FAIL (module not found).

- [ ] **Step 4: Implement `allowlist.ts`; update env**

In `envSchema`: `ALLOWED_EMAILS: z.string().min(1).transform(parseAllowedEmails)`; make `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` required (`z.string().min(1)`). Add `ALLOWED_EMAILS=` with comment "comma-separated, case-insensitive" to `.env.example`.

- [ ] **Step 5: Run** `pnpm test:unit` → PASS; `pnpm typecheck` → clean.

- [ ] **Step 6: Add CI step** `- name: Unit tests\n  run: pnpm test:unit` after Typecheck in `ci.yml`.

- [ ] **Step 7: Commit** `chore: add vitest and email allowlist`

---

### Task 2: Drizzle schema, migration, test database

**Files:**

- Create: `drizzle.config.ts`, `src/server/db/index.ts`, `src/server/db/schema/{auth,categories,transactions,index}.ts`, `src/server/db/migrations/*`, `src/server/db/test-utils.ts`, `src/test/db-global-setup.ts`, `src/server/db/schema.db.test.ts`
- Modify: `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`

**Interfaces:**

- Produces: `getDb(): PostgresJsDatabase<typeof schema>` (memoized, uses `env().DATABASE_URL`); tables `user`, `session`, `account`, `verification`, `categories`, `transactions`; type `Category = typeof categories.$inferSelect`; `TxType = 'out' | 'in'` lives in a new pure file `src/lib/types.ts` (client code such as `lib/format.ts` must not import the Drizzle schema) and the `tx_type` enum values are built from it; `resetDb(): Promise<void>` (`TRUNCATE "user" CASCADE`); `createTestUser(overrides?: Partial<{ id: string; email: string; name: string }>): Promise<{ id: string; email: string }>`.

- [ ] **Step 1: Define schema**

`auth.ts` — better-auth core tables, Drizzle `pgTable`, text ids:

- `user`: id pk, name, email unique, emailVerified bool default false, image null, createdAt/updatedAt timestamptz default now.
- `session`: id pk, expiresAt, token unique, createdAt, updatedAt, ipAddress null, userAgent null, userId → user.id on delete cascade.
- `account`: id pk, accountId, providerId, userId → user cascade, accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password (all nullable), createdAt, updatedAt.
- `verification`: id pk, identifier, value, expiresAt, createdAt, updatedAt.

`categories.ts` / `transactions.ts` — exactly spec §5 columns. Specifics: `pgEnum('tx_type', ['out','in'])`, `pgEnum('tx_source', ['app','zalo'])`; ids `uuid().defaultRandom()`; `categories.userId` text → user cascade; `parentId` → categories.id `onDelete: 'restrict'`; `uniqueIndex('categories_user_slug').on(userId, slug)`; `sortOrder` int default 0. `transactions.amount` `bigint({ mode: 'number' })` + check `amount > 0`; `date` `date({ mode: 'string' })`; `categoryId` → categories restrict; `index('transactions_user_date').on(userId, date)`; `updatedAt` `$onUpdate(() => new Date())`. Zalo tables are Phase 3 — do not add.

- [ ] **Step 2: Config + scripts**

`drizzle.config.ts`: dialect `postgresql`, schema `./src/server/db/schema/index.ts`, out `./src/server/db/migrations`, url from `process.env.DATABASE_URL` (load `.env.local` via `process.loadEnvFile` if present). Scripts: `db:generate` = `drizzle-kit generate`, `db:migrate` = `drizzle-kit migrate`, `db:studio` = `drizzle-kit studio`.

- [ ] **Step 3: Generate migration** — `pnpm db:generate --name init` → one SQL file containing all six tables, both enums, the unique index and the check.

- [ ] **Step 4: Test DB harness**

`createdb expense_test` locally. `db-global-setup.ts`: run `migrate()` from `drizzle-orm/postgres-js/migrator` against `TEST_DATABASE_URL` (same default as setup-env), then close the client. Add vitest project `db`: include `src/**/*.db.test.ts`, `globalSetup`, `fileParallelism: false`.

- [ ] **Step 5: Write `schema.db.test.ts`**

```ts
beforeEach(resetDb);
it('rejects duplicate (userId, slug)', async () => {
  const u = await createTestUser();
  await getDb().insert(categories).values({
    userId: u.id,
    slug: 'food',
    name: 'A',
    icon: 'utensils',
    color: 'food',
    type: 'out',
  });
  await expect(
    getDb().insert(categories).values({
      userId: u.id,
      slug: 'food',
      name: 'B',
      icon: 'utensils',
      color: 'food',
      type: 'out',
    }),
  ).rejects.toThrow();
});
it('allows many null slugs per user', async () => {
  /* two inserts with slug null → both succeed */
});
it('rejects non-positive amount', async () => {
  /* transaction amount 0 → rejects */
});
it('cascades user delete to categories', async () => {
  /* delete user → categories count 0 */
});
```

- [ ] **Step 6: Run** `pnpm vitest run --project db` → PASS.

- [ ] **Step 7: CI** — add `services.postgres` (`postgres:17`, env `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=expense_test`, port 5432, `pg_isready` health check) and change the test step to `pnpm test` with `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/expense_test`.

- [ ] **Step 8: Commit** `feat(db): add drizzle schema and initial migration`

---

### Task 3: Default categories + seeding service

**Files:**

- Create: `src/lib/categories-default.ts`, `src/lib/categories-default.test.ts`, `src/server/services/categories.ts`, `src/server/services/categories.db.test.ts`

**Interfaces:**

- Consumes: `getDb`, `categories`, `createTestUser`, `resetDb` (Task 2); `Locale` from `@/i18n`.
- Produces:

  ```ts
  type DefaultCategory = { slug: string; name: Record<Locale, string>; icon: string; color: CategoryColor; type: TxType; children: { slug: string; name: Record<Locale, string> }[] };
  type CategoryColor = 'food' | 'home' | 'move' | 'shop' | 'fun' | 'health' | 'income';
  const DEFAULT_CATEGORIES: readonly DefaultCategory[];
  ensureDefaultCategories(userId: string, locale: Locale): Promise<void>;
  ```

  Phase 2's parser imports slugs from `DEFAULT_CATEGORIES`.

- [ ] **Step 1: Write `categories-default.test.ts`**

Assert: 7 roots in order `food, home, move, shop, fun, health, income`; 22 children total; every child slug starts with `${root.slug}.`; all slugs unique; only `income` has type `in`; `food` children vi names = `['Ăn sáng','Ăn trưa','Ăn tối','Cà phê']`; every root and child has non-empty `vi` and `en` names.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `DEFAULT_CATEGORIES`** from spec §5 table (slugs) + prototype `CATS0` (icons: food `utensils`, home `house`, move `bike`, shop `shopping-bag`, fun `clapperboard`, health `heart-pulse`, income `wallet`; color = root slug). English names:

| slug   | en            | children en                        |
| ------ | ------------- | ---------------------------------- |
| food   | Food & drink  | Breakfast, Lunch, Dinner, Coffee   |
| home   | Housing       | Rent, Electricity, Water, Internet |
| move   | Transport     | Grab, Fuel, Parking                |
| shop   | Shopping      | Groceries, Clothes, Household      |
| fun    | Entertainment | Netflix, Spotify, Movies           |
| health | Health        | Medicine, Gym                      |
| income | Income        | Salary, Bonus, Other               |

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Write `categories.db.test.ts`**

```ts
beforeEach(resetDb);
it('seeds 7 roots and 22 children with locale names', async () => {
  const u = await createTestUser();
  await ensureDefaultCategories(u.id, 'en');
  const rows = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.userId, u.id));
  expect(rows.filter((r) => r.parentId === null)).toHaveLength(7);
  expect(rows.filter((r) => r.parentId !== null)).toHaveLength(22);
  const lunch = rows.find((r) => r.slug === 'food.lunch')!;
  expect(lunch.name).toBe('Lunch');
  expect(lunch.parentId).toBe(rows.find((r) => r.slug === 'food')!.id);
  expect(lunch).toMatchObject({ icon: 'utensils', color: 'food', type: 'out' });
});
it('is idempotent, including concurrent calls', async () => {
  const u = await createTestUser();
  await Promise.all([
    ensureDefaultCategories(u.id, 'vi'),
    ensureDefaultCategories(u.id, 'vi'),
  ]);
  await ensureDefaultCategories(u.id, 'vi');
  expect(await count(u.id)).toBe(29);
});
it('skips users who already have any category', async () => {
  /* insert one custom category → ensure… → count stays 1 */
});
it('only touches the given user', async () => {
  /* seed u1 → u2 has 0 */
});
```

- [ ] **Step 6: Run** → FAIL.

- [ ] **Step 7: Implement `ensureDefaultCategories`**

In one transaction: return early if the user has ≥1 category; insert roots (`sortOrder` = index) with `onConflictDoNothing({ target: [categories.userId, categories.slug] })`; select the user's root rows to map slug → id (conflicting inserts return nothing); insert children with the parent's icon/color/type, `sortOrder` = index, same `onConflictDoNothing`.

- [ ] **Step 8: Run** `pnpm test` → PASS.

- [ ] **Step 9: Commit** `feat(categories): seed default categories per user`

---

### Task 4: better-auth with Google, allowlist, proxy

**Files:**

- Create: `src/server/auth/hooks.ts`, `src/server/auth/hooks.test.ts`, `src/server/auth/index.ts`, `src/server/auth/session.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`, `src/proxy.test.ts`

**Interfaces:**

- Consumes: `isEmailAllowed` (Task 1), `getDb`, schema (Task 2), `ensureDefaultCategories` (Task 3).
- Produces:

  ```ts
  // hooks.ts
  localeFromCookieHeader(cookieHeader: string | null | undefined): Locale; // NEXT_LOCALE, default 'vi'
  createDatabaseHooks(deps: {
    allowed: Set<string>;
    findUserEmail(userId: string): Promise<string | null>;
    ensureCategories(userId: string, locale: Locale): Promise<void>;
  }): BetterAuthOptions['databaseHooks'];
  NOT_INVITED = 'not_invited';
  // index.ts
  getAuth(): ReturnType<typeof betterAuth>; // memoized; never evaluated at import time so `next build` needs no secrets
  // session.ts
  requireSession(): Promise<{ user: { id: string; name: string; email: string; image: string | null } }>; // redirect('/login') when absent
  // auth-client.ts
  authClient = createAuthClient(); // from 'better-auth/react'
  // proxy.ts
  isPublicPath(pathname: string): boolean;
  ```

- [ ] **Step 1: Write `hooks.test.ts`**

```ts
const deps = (over = {}) => ({
  allowed: new Set(['ok@x.com']),
  findUserEmail: vi.fn(async () => 'ok@x.com'),
  ensureCategories: vi.fn(async () => {}),
  ...over,
});
it('user.create.before throws not_invited for unlisted email', async () => {
  const h = createDatabaseHooks(deps());
  await expect(
    h.user.create.before({ email: 'no@x.com' } as any, null),
  ).rejects.toMatchObject({ body: { code: 'not_invited' } });
});
it('user.create.before passes listed email', async () => {
  /* resolves, no throw */
});
it('session.create.before blocks a user whose email was removed from the list', async () => {
  const h = createDatabaseHooks(
    deps({ findUserEmail: vi.fn(async () => 'removed@x.com') }),
  );
  await expect(
    h.session.create.before({ userId: 'u1' } as any, null),
  ).rejects.toMatchObject({ body: { code: 'not_invited' } });
});
it('session.create.after seeds with the cookie locale', async () => {
  const d = deps();
  const h = createDatabaseHooks(d);
  await h.session.create.after(
    { userId: 'u1' } as any,
    { headers: new Headers({ cookie: 'a=1; NEXT_LOCALE=en' }) } as any,
  );
  expect(d.ensureCategories).toHaveBeenCalledWith('u1', 'en');
});
it.each([
  [null, 'vi'],
  ['NEXT_LOCALE=fr', 'vi'],
  ['NEXT_LOCALE=en', 'en'],
])('localeFromCookieHeader(%s) = %s', (h, l) =>
  expect(localeFromCookieHeader(h)).toBe(l),
);
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `hooks.ts`**

Reject with `new APIError('FORBIDDEN', { code: NOT_INVITED, message: NOT_INVITED })` from `better-auth/api`; the OAuth callback (`better-auth/dist/api/routes/callback.mjs`) turns an `APIError` with `body.code` into a redirect to `errorCallbackURL?error=<code>`. Seeding runs on every `session.create.after` (not `user.create.after`) so a failed first seed heals on the next login; `ensureDefaultCategories` is cheap when categories exist. Cookie source: `context?.headers ?? context?.request?.headers`.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Write `proxy.test.ts`**

```ts
it.each(['/login', '/api/auth/callback/google', '/api/zalo/webhook'])(
  '%s is public',
  (p) => expect(isPublicPath(p)).toBe(true),
);
it.each(['/', '/transactions', '/settings', '/loginx'])(
  '%s is protected',
  (p) => expect(isPublicPath(p)).toBe(false),
);
```

- [ ] **Step 6: Implement auth wiring**

- `index.ts`: `betterAuth({ baseURL: env().APP_URL, secret: env().BETTER_AUTH_SECRET, database: drizzleAdapter(getDb(), { provider: 'pg', schema }), socialProviders: { google: { clientId, clientSecret, prompt: 'select_account' } }, onAPIError: { errorURL: '/login' }, databaseHooks: createDatabaseHooks({ allowed: env().ALLOWED_EMAILS, findUserEmail: <select email from user>, ensureCategories: ensureDefaultCategories }), plugins: [nextCookies()] })` — `nextCookies` must be last.
- `route.ts`: `GET`/`POST` delegate to `toNextJsHandler(getAuth())`.
- `session.ts`: `import 'server-only'`; `getAuth().api.getSession({ headers: await headers() })`, `redirect('/login')` if null. Wrap in React `cache()`.
- `proxy.ts`: export `proxy(request)`: public path → next; no `getSessionCookie(request)` → redirect `/login`; cookie present and path `/login` → redirect `/`. `config.matcher`: `['/((?!_next/static|_next/image|favicon.ico|images/).*)']`. `isPublicPath`: exact `/login`, or prefix `/api/auth/`, `/api/zalo/`.

- [ ] **Step 7: Run** `pnpm test:unit && pnpm typecheck && pnpm build` → all pass (build without `.env.local` proves lazy env).

- [ ] **Step 8: Commit** `feat(auth): google sign-in with email allowlist`

(End-to-end OAuth is verified in Task 8 once the login button exists.)

---

### Task 5: TH theme, fonts, icons

**Files:**

- Create: `src/app/styles/tokens/{colors,radius,elevation,motion,typography,spacing}.css`
- Modify: `src/app/styles/index.css`, `src/app/styles/customComponent.css`, `src/app/layout.tsx`, `src/components/layouts/switchTheme.tsx`, `package.json`

**Interfaces:**

- Produces (Tailwind utilities later tasks use): colors `bg-base`, `bg-canvas`, `bg-sunken`, `bg-card`, `bg-inset`, `bg-hover`, `bg-selected`, `text-strong`, `text-body`, `text-muted`, `text-subtle`, `text-accent-text`, `text-success-text`, `text-danger-text`, `border-subtle`, `bg-accent-soft`, `cat-food` … `cat-income` (`bg-cat-food/14` for tiles); radii `rounded-control` (14), `rounded-card` (20), `rounded-panel` (24), `rounded-modal` (28), `rounded-sheet` (32), `rounded-tag` (10); shadows `shadow-sm|md|lg` (TH values); fonts `font-sans` (Space Grotesk), `font-mono` (Plex Mono); variant `wide:` = `@media (width >= 900px)`; utility classes `type-h1 … type-overline` from handoff type roles.

- [ ] **Step 1:** Copy the handoff token files (`docs/design_handoff_so_chi/design/_ds/th-design-system-*/tokens/`) into `src/app/styles/tokens/`, except `fonts.css` (Google Fonts `@import` is replaced by `next/font`) and `base.css` (review it; fold anything needed into `index.css`).

- [ ] **Step 2:** Read `.heroui-docs/react/getting-started/(handbook)/theming.mdx` and `colors.mdx`. Replace the current oklch values in `index.css` with mappings to TH semantics for both `:root` and `[data-theme='dark']`: `--accent`→`--accent-solid`, `--accent-foreground`→`--text-on-accent`, `--background`→`--bg-base`, `--foreground`→`--text-strong`, `--surface`→`--surface-card`, `--surface-secondary`→`--surface-inset`, `--surface-tertiary`→`--bg-sunken`, `--overlay`→`--surface-overlay`, `--muted`→`--text-muted`, `--border`/`--separator`→`--border-subtle`, `--field-background`→`--bg-canvas`, `--focus`→`--border-focus`, `--danger`/`--success`/`--warning`→`*-solid`, `--default`→`--bg-sunken`, `--default-foreground`→`--text-body`, `--radius`/`--field-radius` → 14px. Add `@theme inline` entries for the utilities listed above and `--breakpoint-wide: 900px`. Keep the `data-hide-on-theme` rule.

- [ ] **Step 3:** In `layout.tsx` load `Space_Grotesk` (`--font-space-grotesk`, weights 400/500/600) and `IBM_Plex_Mono` (`--font-plex-mono`, 400/500/600); body `bg-base text-body font-sans`. Update metadata title template/default to "Sổ Chi". `common.appName` → "Sổ Chi" in both message files.

- [ ] **Step 4:** `pnpm add lucide-react`; `switchTheme.tsx` uses lucide `Sun`/`Moon` (size 18, strokeWidth 1.75), ghost icon button.

- [ ] **Step 5: Verify** — `pnpm dev`, open `/login`: Space Grotesk renders, background `#F4F6F9` light / `#05070F` dark (toggle works), a HeroUI primary button is `#3B6BF5`. `pnpm build` passes.

- [ ] **Step 6: Commit** `feat(ui): apply TH design tokens to HeroUI`

---

### Task 6: Shared UI — Money, ResponsiveSheet, toast

**Files:**

- Create: `src/lib/format.ts`, `src/lib/format.test.ts`, `src/components/ui/money.tsx`, `src/components/ui/responsive-sheet.tsx`, `src/components/ui/toast.tsx`, `src/hooks/use-is-wide.ts`
- Modify: `src/app/layout.tsx` (mount toast region), `messages/*.json`

**Interfaces:**

- Produces:

  ```ts
  formatVnd(amount: number): string;                      // 45000 → "45.000 ₫"
  formatSignedVnd(amount: number, type: TxType): string;  // "−45.000 ₫" | "+45.000 ₫"
  <Money amount={number} type?={TxType} className? />    // mono; type 'in' → text-success-text; no type → unsigned
  useIsWide(): boolean;                                   // matchMedia('(min-width: 900px)'), false on server
  <ResponsiveSheet isOpen onOpenChange title children footer? />
  showToast(opts: { title: string; onUndo?: () => void }): void;
  <AppToaster />
  ```

  Phase 2 extends `format.ts` (short form, date labels) — keep it pure.

- [ ] **Step 1: Write `format.test.ts`**

```ts
expect(formatVnd(45000)).toBe('45.000 ₫');
expect(formatVnd(25000000)).toBe('25.000.000 ₫');
expect(formatVnd(0)).toBe('0 ₫');
expect(formatSignedVnd(45000, 'out')).toBe('−45.000 ₫');
expect(formatSignedVnd(45000, 'in')).toBe('+45.000 ₫');
```

- [ ] **Step 2: Run** → FAIL. **Step 3:** implement with a module-level `Intl.NumberFormat('vi-VN')` (independent of UI locale). **Step 4: Run** → PASS.

- [ ] **Step 5: Components**

- `ResponsiveSheet`: read `modal.mdx` and `drawer.mdx` first. Wide → HeroUI Modal, width 560, `rounded-modal`; narrow → Drawer placement bottom, full width, radius `32 32 0 0`, safe-area bottom padding. Both: scrim with 3px blur, outside click closes, header = h4 title + ghost close button (lucide `X`, aria-label `t('common.close')`).
- `toast.tsx`: read `toast.mdx`. `AppToaster` = HeroUI toast region, placement top-center, max width 380, timeout 3200ms. `showToast` with `onUndo` renders a ghost "Hoàn tác" button (`common.undo`) that calls `onUndo` and dismisses.
- Messages: `common.close` "Đóng"/"Close", `common.undo` "Hoàn tác"/"Undo".

- [ ] **Step 6: Verify** — `pnpm test:unit`, `pnpm typecheck` pass; components exercised visually in Task 7.

- [ ] **Step 7: Commit** `feat(ui): add money, responsive sheet and toast`

---

### Task 7: App shell

**Files:**

- Create: `src/features/shell/{nav.ts,logo-tile.tsx,sidebar.tsx,tab-bar.tsx,tx-sheet-host.tsx}`, `src/app/(main)/transactions/page.tsx`, `src/app/(main)/categories/page.tsx`, `src/app/(main)/settings/page.tsx`, `src/features/settings/logout-button.tsx`
- Modify: `src/app/(main)/layout.tsx`, `src/app/(main)/page.tsx`, `src/components/layouts/switchLocale.tsx`, `messages/*.json`

**Interfaces:**

- Consumes: `requireSession` (Task 4), `ResponsiveSheet`, `showToast` (Task 6), `authClient` (Task 4).
- Produces: `NAV_ITEMS: { href: '/' | '/transactions' | '/categories' | '/settings'; labelKey: string; icon: LucideIcon }[]`; `<LogoTile size={32 | 40} />`; sheet opened by `?tx=new` or `?tx=<id>` from anywhere in `(main)`; Phase 2 replaces the placeholder body inside `TxSheetHost`.

- [ ] **Step 1: Layout + nav**

`(main)/layout.tsx` (server): `const { user } = await requireSession()`; renders `<Sidebar user>` (hidden below `wide:`), `<main>` (padding narrow `20px 16px 24px` + tab bar height + safe-area, wide `32px 32px 48px`), `<TabBar>` (hidden at `wide:`), `<TxSheetHost>` inside `<Suspense>` (uses `useSearchParams`). `NAV_ITEMS`: `/` `LayoutDashboard` `nav.home`; `/transactions` `List` `nav.transactions`; `/categories` `Tags` `nav.categories`; `/settings` `Settings` `nav.settings`.

- [ ] **Step 2: Sidebar (handoff "Layout shell → Wide")** — floating 248px, margin 12, `rounded-panel`, `bg-canvas`, padding 20/14. Top: `LogoTile` 32 (accent bg, white lucide `Wallet`) + "Sổ Chi" h4, then `SwitchLocale` + `ThemeSwitch`. Primary full-width "Thêm giao dịch" (`nav.addTransaction`) → push `?tx=new` on current path. Nav items: icon 18 + label 15/500, padding 9×10, `rounded-tag`; active (`usePathname`, exact for `/`, prefix otherwise) = `bg-selected text-accent-text`. Footer: HeroUI Avatar (user.image, initials fallback) + name + email, links to `/settings`.

- [ ] **Step 3: Tab bar (narrow)** — fixed bottom, `bg-canvas/88` + `backdrop-blur`, border-top subtle, `padding-bottom: env(safe-area-inset-bottom)`. Order: Tổng quan, Giao dịch, center 46px circular primary `Plus` button (aria-label `nav.addTransaction`, opens `?tx=new`), Danh mục, Cài đặt. Icon 21, label 11/500; active `text-accent-text`, inactive `text-subtle`.

- [ ] **Step 4: TxSheetHost** — client; `tx = useSearchParams().get('tx')`; `isOpen = tx !== null`; close → `router.replace(pathname + remaining params, { scroll: false })`. Title `tx === 'new' ? t('tx.addTitle') : t('tx.editTitle')`. Body placeholder: caption "Phase 2". Footer: Hủy closes; a temporary "Thử toast" button calls `showToast({ title: t('tx.added'), onUndo: () => {} })` so toast can be verified — delete in Phase 2.

- [ ] **Step 5: Pages** — Home: overline + h2 `home.greeting` ("Chào {name}" / "Hi {name}") with first name; on narrow header, Avatar → `/settings`. Transactions/Categories: h2 title only. Settings: h2 + `LogoutButton` (secondary full width, lucide `LogOut`, `authClient.signOut()` then `router.replace('/login')`).

- [ ] **Step 6: Messages** (vi / en): `nav.home` Tổng quan / Overview; `nav.transactions` Giao dịch / Transactions; `nav.categories` Danh mục / Categories; `nav.settings` Cài đặt / Settings; `nav.addTransaction` Thêm giao dịch / Add transaction; `tx.addTitle` Thêm giao dịch / Add transaction; `tx.editTitle` Sửa giao dịch / Edit transaction; `tx.added` Đã thêm giao dịch / Transaction added; `common.cancel` Hủy / Cancel; `home.greeting` Chào {name} / Hi {name}; `settings.logout` Đăng xuất / Sign out. Replace react-icons in `switchLocale.tsx` only if any; keep its behavior.

- [ ] **Step 7: Verify** — `pnpm typecheck && pnpm lint && pnpm build`. Signed in, at 1280px and 390px, in light and dark, compare with the prototype: sidebar/tab bar placement, active state, `+` opens sheet as modal (wide) / bottom drawer (narrow), close clears `?tx`, toast top-center auto-hides ~3.2s with "Hoàn tác", locale switch flips all shell copy, sign out → `/login`.

- [ ] **Step 8: Commit** `feat(shell): add sidebar, tab bar and transaction sheet host`

---

### Task 8: Login page

**Files:**

- Modify: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `messages/*.json`
- Create: `src/features/auth/google-button.tsx`

**Interfaces:**

- Consumes: `authClient` (Task 4), `NOT_INVITED` (Task 4), `LogoTile` (Task 7).

- [ ] **Step 1: Layout** — full-height `bg-base`, centered column max-w 400, `SwitchLocale` + `ThemeSwitch` top-right.

- [ ] **Step 2: Page (handoff Screen 0)** — `LogoTile` 40 + "Sổ Chi" h3; overline `auth.overline`; h1 `auth.headline`; body muted `auth.subtitle`; card (`rounded-card`, border-subtle, shadow-sm) with `GoogleButton` + caption `auth.footer`. Reads `searchParams.error`: `not_invited` → danger Alert `auth.errors.not_invited`; any other value → `auth.errors.google_login_failed`. (Read `alert.mdx`.)

- [ ] **Step 3: GoogleButton** — client; HeroUI Button secondary lg full width, `FcGoogle` icon, `isPending` while redirecting; `authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/login' })`.

- [ ] **Step 4: Messages** — replace the whole `auth` namespace (drop password/email keys):

| key                        | vi (verbatim)                                                                                  | en                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| overline                   | Quản lý chi tiêu cá nhân và nhóm                                                               | Personal & group expense tracking                                                                      |
| headline                   | Biết tiền đi đâu, từng khoản một.                                                              | Know where your money goes, one entry at a time.                                                       |
| subtitle                   | Gõ “ăn phở 45k” là có giao dịch. Hỏi “tháng này tiêu bao nhiêu cho cà phê?” là có câu trả lời. | Type “ăn phở 45k” and it’s logged. Ask “how much did I spend on coffee this month?” and get an answer. |
| continueWithGoogle         | Tiếp tục với Google                                                                            | Continue with Google                                                                                   |
| footer                     | Dữ liệu đồng bộ giữa điện thoại và máy tính.                                                   | Your data syncs between phone and computer.                                                            |
| errors.not_invited         | Email này chưa được mời dùng Sổ Chi                                                            | This email hasn’t been invited to Sổ Chi                                                               |
| errors.google_login_failed | Đăng nhập Google thất bại. Vui lòng thử lại.                                                   | Google sign-in failed. Please try again.                                                               |

`footer` drops the handoff's "vẫn dùng được khi offline" clause because the MVP is online-only (spec §3).

- [ ] **Step 5: Verify end-to-end** (needs `.env.local` with Google creds, `ALLOWED_EMAILS`, local DB migrated via `pnpm db:migrate`):
  1. Allowlisted Google account → lands on `/`, shell shows name; `select count(*) from categories where "userId" = …` = 29, names in the locale active at login.
  2. Non-allowlisted account → `/login?error=not_invited` with the message; no `user` row created.
  3. Remove your email from `ALLOWED_EMAILS`, restart, sign out and back in → `/login?error=not_invited`.
  4. Signed out, visit `/transactions` → `/login`; signed in, visit `/login` → `/`.

- [ ] **Step 6: Commit** `feat(auth): login page per design`

---

### Task 9: Phase exit check

**Files:**

- Modify: `README.md`

- [ ] **Step 1:** README: rename to Sổ Chi; add setup lines `createdb expense && createdb expense_test`, `pnpm db:migrate`, `ALLOWED_EMAILS`; add `pnpm test`, `pnpm db:generate`, `pnpm db:migrate` to the scripts table.
- [ ] **Step 2:** Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all pass.
- [ ] **Step 3:** Re-run the spec's Phase 1 "Xong khi" checklist: allowlisted login works, unlisted blocked, shell matches design at both breakpoints and both themes, DB has seeded categories.
- [ ] **Step 4: Commit** `docs: update readme for phase 1`
