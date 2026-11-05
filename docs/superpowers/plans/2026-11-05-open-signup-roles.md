# Open Sign-up, Roles and User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any Google account use Sổ Chi, give admins a mobile page to manage users, and cap each user's daily AI use.

**Architecture:** `ALLOWED_EMAILS` is replaced by a `blocked_at` column checked at the same points. Roles live on `user` and reach `session.user` through better-auth `additionalFields`. A thin guard (`requireAdmin`, `defineAdminAction`) fronts a `users` service, and an atomic `ai_usage` counter gates OpenAI calls.

**Tech Stack:** Next.js 16 App Router, better-auth 1.7, Drizzle + Postgres, HeroUI v3, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-open-signup-roles-design.md`

## Global Constraints

- Login stays Google only. Do not add better-auth's `admin` plugin or use CASL.
- Roles are exactly `'admin' | 'user'`; new accounts are `user`.
- `role` and `blockedAt` are `input: false` in better-auth, so clients cannot set them.
- Do not enable better-auth `cookieCache`: instant block and demote depend on every request reading the `user` row.
- `AI_DAILY_LIMIT`: optional positive integer, default `100`. Admins are exempt.
- `today` always comes from `todayVn()`, so the AI count resets at midnight Vietnam time.
- User ids are better-auth text ids, not UUIDs. Validate with `z.string().min(1)`, never `z.uuid()`.
- Every new string goes in both `messages/en.json` and `messages/vi.json`. Zalo bot replies are Vietnamese only.
- `/admin/users` is not added to `NAV_ITEMS`.
- HeroUI: `.heroui-docs` is not in this checkout. Copy `AlertDialog` usage from `src/features/categories/category-card.tsx`, and take the `Dropdown` API from `node_modules/@heroui/react/dist/components/dropdown/dropdown.d.ts` (resolve the path through `node_modules/.pnpm` if needed).
- Next.js: read `node_modules/next/dist/docs/` before changing routing code, per `AGENTS.md`.
- Comments only for a non-obvious WHY (`CLAUDE.md`).
- DB tests need the local Postgres on port 5433 (`docker compose up -d`).

## Review Focus

Failure modes the spec implies but does not test. Each has a test in the owning task.

1. **A blocked user redeems an unused Zalo link code.** Expect no "linked" reply: the code is refused. Otherwise the bot confirms a link, then answers "not linked" to everything. (Task 2)
2. **A client posts `role: 'admin'` to `/api/auth/update-user`.** Expect rejection. This is the one path to privilege escalation that bypasses our guards. (Task 2)
3. **Deleting a user who has soft-deleted transactions.** Expect success. A filter on `deleted_at` would leave rows that break the delete through `ON DELETE RESTRICT`. (Task 4)
4. **`AI_DAILY_LIMIT=` set to an empty string**, as on Vercel or a copied `.env.example`. Expect the default of 100. `z.coerce` turns `''` into `0`, which would fail `env()` and take the whole app down. (Task 6)
5. **`pnpm admin:grant Owner@Gmail.com` with mixed case.** Expect a match, because better-auth stores emails lowercased. (Task 5)

---

## Task 1: Schema and migration

**Files:**

- Create: `src/server/db/schema/ai-usage.ts`, `src/server/db/migrations/0002_roles_ai_usage.sql` (generated, plus its meta files)
- Modify: `src/server/db/schema/auth.ts`, `src/server/db/schema/index.ts`, `src/server/db/test-utils.ts`, `src/lib/types.ts`
- Test: `src/server/db/schema.db.test.ts`

**Interfaces:**

- Produces:
  - `UserRole = 'admin' | 'user'` from `@/lib/types`
  - `USER_ROLES` (`as const satisfies readonly UserRole[]`, same pattern as `TX_TYPES`) from `@/server/db/schema`
  - `user.role`, `user.blockedAt`, table `aiUsage` with `userId`, `day`, `count`
  - `createTestUser(overrides)` also accepting `role?: UserRole` and `blockedAt?: Date | null`

- [ ] **Step 1: Write the failing tests** in `schema.db.test.ts`

```ts
it('defaults new users to role user and not blocked', async () => {
  const u = await createTestUser();
  const [row] = await getDb().select().from(user).where(eq(user.id, u.id));
  expect(row.role).toBe('user');
  expect(row.blockedAt).toBeNull();
});

it('cascades ai_usage when the user is deleted', async () => {
  const u = await createTestUser();
  await getDb()
    .insert(aiUsage)
    .values({ userId: u.id, day: '2026-11-05', count: 1 });
  await getDb().delete(user).where(eq(user.id, u.id));
  expect(await getDb().select().from(aiUsage)).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project db src/server/db/schema.db.test.ts`
Expected: FAIL (`aiUsage` is not exported).

- [ ] **Step 3: Implement the schema**

- `user.role`: `text('role').$type<UserRole>().notNull().default('user')`
- `user.blockedAt`: `timestamp('blocked_at', { withTimezone: true })`
- `aiUsage` = `pgTable('ai_usage', …)`: `userId` text not null references `user.id` on delete cascade; `day` as `date('day', { mode: 'string' })` not null; `count` integer not null default 0; `primaryKey({ columns: [t.userId, t.day] })`.
- Export from `schema/index.ts`.

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate --name=roles_ai_usage`
Expected: `0002_roles_ai_usage.sql` containing only two `ADD COLUMN`s, one `CREATE TABLE`, and one FK. No `DROP`.

- [ ] **Step 5: Run to verify they pass**

Run: `pnpm vitest run --project db src/server/db/schema.db.test.ts`
Expected: PASS (global setup applies the migration).

- [ ] **Step 6: Commit**

```bash
git add src/server/db src/lib/types.ts
git commit -m "feat(db): add user role, blocked_at and ai_usage"
```

---

## Task 2: Replace the allowlist with blocking

All of this lands together: `env()`, hooks, session and the Zalo lookup share the allowlist, so a partial removal does not compile.

**Files:**

- Create: `src/server/auth/user-fields.ts`, `src/server/auth/user-fields.test.ts`
- Delete: `src/server/auth/allowlist.ts`, `src/server/auth/allowlist.test.ts`
- Modify: `src/server/auth/hooks.ts`, `hooks.test.ts`, `index.ts`, `session.ts`, `session.test.ts`
- Modify: `src/server/services/zalo-link.ts`, `zalo-link.db.test.ts`, `src/server/zalo/handler.ts`, `handler.test.ts`
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/api/receipts/[id]/route.ts`, `src/app/layout.tsx:73` (comment says "allowlisted")
- Modify: `src/configs/env.ts`, `src/test/setup-env.ts`, `.env.example`, `README.md:31`, `messages/en.json`, `messages/vi.json`
- Modify: `src/server/action.test.ts` (its session mock gains `role: 'user'`)

**Interfaces:**

- Consumes: `user.role`, `user.blockedAt`, `UserRole` from Task 1
- Produces:
  - `BLOCKED = 'blocked'` from `@/server/auth/hooks`
  - `DatabaseHookDeps = { isBlocked(userId: string): Promise<boolean>; ensureCategories(...) }`
  - `SessionStatus<S> = { status: 'ok'; session: S } | { status: 'none' } | { status: typeof BLOCKED; session: S }`
  - `classifySession<S extends { user: { blockedAt?: Date | null } }>(session: S | null): SessionStatus<S>`
  - `getActiveSession()`, `requireSession()` and `AppSession['user'].role: UserRole`
  - `findActiveUserIdByZaloId(zaloUserId: string): Promise<string | null>`

- [ ] **Step 1: Write the failing tests**

`user-fields.test.ts`, exercising better-auth's real input parser:

```ts
import { parseUserInput } from 'better-auth/db';

const options = { user: { additionalFields: USER_ADDITIONAL_FIELDS } };

it('rejects a client setting role', () => {
  expect(() => parseUserInput(options, { role: 'admin' }, 'update')).toThrow(
    /role is not allowed/,
  );
});
it('rejects a client setting blockedAt', () => {
  expect(() =>
    parseUserInput(options, { blockedAt: new Date() }, 'update'),
  ).toThrow(/blockedAt is not allowed/);
});
it('forces the default role on create, whatever is sent', () => {
  expect(parseUserInput(options, { role: 'admin' }, 'create').role).toBe(
    'user',
  );
});
```

`session.test.ts`, replacing the allowlist cases:

```ts
expect(classifySession({ user: { blockedAt: null } })).toEqual({
  status: 'ok',
  session: expect.anything(),
});
expect(classifySession({ user: { blockedAt: new Date() } })).toMatchObject({
  status: 'blocked',
});
expect(classifySession({ user: {} })).toMatchObject({ status: 'ok' });
expect(classifySession(null)).toEqual({ status: 'none' });
```

`hooks.test.ts`: delete both `user.create.before` tests and the `allowed` dep, then cover:

- `session.create.before` throws `{ body: { code: 'blocked' } }` when `isBlocked` resolves true.
- It resolves and calls `isBlocked('u1')` when false.
- `createDatabaseHooks(deps())` has no `user` key.

`zalo-link.db.test.ts`, replacing the `findAllowedUserIdByZaloId` block:

```ts
describe('findActiveUserIdByZaloId', () => {
  it('returns the linked user until blocked, and again after unblock', async () => {
    const u = await createTestUser();
    await redeem((await createLinkCode(u.id, NOW)).code, 'Z1');
    expect(await findActiveUserIdByZaloId('Z1')).toBe(u.id);
    await getDb().update(user).set({ blockedAt: NOW }).where(eq(user.id, u.id));
    expect(await findActiveUserIdByZaloId('Z1')).toBeNull();
    await getDb()
      .update(user)
      .set({ blockedAt: null })
      .where(eq(user.id, u.id));
    expect(await findActiveUserIdByZaloId('Z1')).toBe(u.id);
    expect(await findActiveUserIdByZaloId('Z3')).toBeNull();
  });
});

it('refuses a link code owned by a blocked user and leaves it unused', async () => {
  const u = await createTestUser({ blockedAt: NOW });
  const { code } = await createLinkCode(u.id, NOW);
  expect(await redeem(code)).toBeNull();
  expect(await findUserIdByZaloId('z1')).toBeNull();
});
```

`handler.test.ts`: rename the mock to `findActiveUserIdByZaloId`, and retitle the allowlist case to `'treats a blocked user as not linked'`. Its assertions stay the same.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/server/auth src/server/zalo/handler.test.ts src/server/services/zalo-link.db.test.ts`
Expected: FAIL (`user-fields` missing, `classifySession` arity, `findActiveUserIdByZaloId` undefined).

- [ ] **Step 3: Implement auth**

- `user-fields.ts`: `export const USER_ADDITIONAL_FIELDS` with `role: { type: 'string', required: true, defaultValue: 'user', input: false }` and `blockedAt: { type: 'date', required: false, input: false }`, `as const`. Pass it as `user: { additionalFields: USER_ADDITIONAL_FIELDS }` in `betterAuth()`.
- `hooks.ts`: replace `NOT_INVITED` with `BLOCKED` and `notInvited()` with `blocked()`. Remove the `user` hook, its types and the allowlist import. Update the `session.create.before` comment.
- `index.ts`: `isBlocked` selects `blockedAt` for the id and returns `row?.blockedAt != null`. A missing row returns false; the session insert's FK rejects it anyway.
- `session.ts`: rename to `getActiveSession`. `requireSession` redirects to `/login?error=${BLOCKED}` and returns `role: role === 'admin' ? 'admin' : 'user'`, so an unexpected value fails closed.

- [ ] **Step 4: Implement the rest of the removal**

- `zalo-link.ts`: rename the lookup, select `blockedAt` instead of `email`, and return null when set. In `redeemLinkCode`, after locking the code row, select the owner's `blockedAt` and return null if set, before marking the code used. Unblocking leaves the code usable until it expires. `createLinkCode` needs no change, because a blocked user has no session.
- `handler.ts`, `login/page.tsx`, `receipts/[id]/route.ts`: rename. The login error key becomes `error === BLOCKED ? 'blocked' : 'google_login_failed'`.
- `env.ts`: drop `ALLOWED_EMAILS` and the import. `setup-env.ts`: drop the key. `.env.example`: drop the key and its comment. `README.md`: drop line 31.
- `layout.tsx`: comment becomes `// Private app: keep every page out of search results.`
- Messages: replace `auth.errors.not_invited` with `blocked`. en: `This account has been blocked`. vi: `Tài khoản này đã bị khóa`.

- [ ] **Step 5: Run to verify they pass, and that no reference survives**

Run: `pnpm vitest run && pnpm typecheck && git grep -nE 'ALLOWED_EMAILS|allowlist|not_invited|NOT_INVITED|getAllowedSession|findAllowedUserId' -- src messages README.md .env.example`
Expected: tests and typecheck pass, and `git grep` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add -A src messages README.md .env.example
git commit -m "feat(auth): replace the email allowlist with blocking"
```

---

## Task 3: Admin guard

**Files:**

- Modify: `src/server/auth/session.ts`, `src/server/action.ts`, `src/server/services/errors.ts`, `src/lib/action-result.ts`, `messages/en.json`, `messages/vi.json`
- Test: `src/server/action.test.ts`

**Interfaces:**

- Consumes: `requireSession()`, `AppSession['user'].role` from Task 2
- Produces:
  - `requireAdmin(): Promise<AppSession>`
  - `defineAdminAction(schema, handler: (actorId: string, input) => Promise<T>, options?)`, same shape as `defineAction`
  - `ActionErrorCode` gains `'forbidden'`
  - `ServiceErrorCode` gains `'cannot_modify_self'`

- [ ] **Step 1: Write the failing tests** in `action.test.ts`

```ts
describe('defineAdminAction', () => {
  const asRole = (role: 'admin' | 'user') =>
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: 'u1', name: 'A', email: 'a@x.com', image: null, role },
    });

  it('returns forbidden for a non-admin without running the handler', async () => {
    asRole('user');
    const handler = vi.fn();
    expect(await defineAdminAction(schema, handler)({ n: 1 })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(handler).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns forbidden, not invalid_input, for a non-admin with bad input', async () => {
    asRole('user');
    expect(
      await defineAdminAction(schema, vi.fn())({ n: 'x' } as never),
    ).toEqual({ ok: false, error: 'forbidden' });
  });

  it('passes the actor id to the handler for an admin', async () => {
    asRole('admin');
    const handler = vi.fn(async () => 42);
    expect(await defineAdminAction(schema, handler)({ n: 1 })).toEqual({
      ok: true,
      data: 42,
    });
    expect(handler).toHaveBeenCalledWith('u1', { n: 1 });
  });

  it('maps ServiceError for an admin', async () => {
    asRole('admin');
    const res = await defineAdminAction(schema, async () => {
      throw new ServiceError('cannot_modify_self');
    })({ n: 1 });
    expect(res).toEqual({ ok: false, error: 'cannot_modify_self' });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/server/action.test.ts`
Expected: FAIL (`defineAdminAction` not exported).

- [ ] **Step 3: Implement**

- `action.ts`: extract the parse, run and error-mapping body of `defineAction` into a private helper taking the session user's id. `defineAdminAction` calls `requireSession()`, returns `forbidden` if `role !== 'admin'`, then calls the helper. Existing `defineAction` tests must pass unchanged.
- `session.ts`: `requireAdmin` calls `requireSession()`, then `notFound()` for a non-admin. Wrap it in `cache` like its neighbours.
- `errors.*` messages:
  - `forbidden`: en `You don’t have permission to do that`, vi `Bạn không có quyền làm việc này`
  - `cannot_modify_self`: en `You can’t change your own account here`, vi `Bạn không thể tự thay đổi tài khoản của mình`

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run src/server/action.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server src/lib/action-result.ts messages
git commit -m "feat(auth): add admin guards for pages and actions"
```

---

## Task 4: Users service and data isolation

**Files:**

- Create: `src/server/services/users.ts`, `src/server/services/users.db.test.ts`, `src/server/services/data-isolation.db.test.ts`

**Interfaces:**

- Consumes: `ServiceError('cannot_modify_self')` from Task 3, `createTestUser({ role, blockedAt })` from Task 1
- Produces:
  - `UserListItem = { id: string; name: string; email: string; image: string | null; role: UserRole; blockedAt: Date | null; createdAt: Date }`
  - `listUsers(): Promise<UserListItem[]>`
  - `setUserRole(actorId: string, targetId: string, role: UserRole): Promise<void>`
  - `blockUser(actorId: string, targetId: string): Promise<void>`
  - `unblockUser(actorId: string, targetId: string): Promise<void>`
  - `deleteUser(actorId: string, targetId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests** in `users.db.test.ts`

Use `beforeEach(resetDb)` and a `seedUserWithData(id)` helper: `ensureDefaultCategories(id, LOCALE.VI)`, then one live and one soft-deleted transaction on a child category.

- `lists users newest first`: set `createdAt` explicitly; assert id order and that the fields equal `UserListItem`.
- `setUserRole promotes and demotes`.
- `blockUser sets blocked_at and removes every session of the target only`: insert sessions for target and bystander, then assert the target has 0 and the bystander 1.
- `unblockUser clears blocked_at and keeps the Zalo link`: assert `findActiveUserIdByZaloId` returns the user after unblock.
- `deleteUser removes a user with live and soft-deleted transactions and nested categories`: assert `user`, `transactions`, `categories` and `session` have no rows for the target, and that `zaloLinks` and `aiUsage` rows are gone.
- `deleteUser leaves other users' data alone`.
- `it.each` over all four mutators, rejecting with `{ code: 'cannot_modify_self' }` when `actorId === targetId`.
- `it.each` over all four mutators, rejecting with `{ code: 'not_found' }` for a missing target.
- `an admin can act on another admin`.

`data-isolation.db.test.ts`, seeding user A with a transaction and a category, and user B empty. Existing tests already cover writes to transactions; this adds reads and category listing:

- `listTransactions(B, {})`, `recentTransactions(B, …)` and `listCategories(B)` return nothing of A's.
- `monthSummary(B, …)` totals are zero.
- `getTransaction(B, txA)`, `updateTransaction(B, txA, …)` and `softDeleteTransaction(B, txA)` reject with `{ code: 'not_found' }`.
- `deleteSubcategory(B, childA)` rejects.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run --project db src/server/services/users.db.test.ts src/server/services/data-isolation.db.test.ts`
Expected: `users` tests FAIL (module missing). Isolation tests should already PASS. If one fails, that is a real leak: stop and fix it in its service.

- [ ] **Step 3: Implement `users.ts`**

- A private `assertNotSelf(actorId, targetId)` runs first in each mutator.
- Update-based mutators use `.returning({ id })`; an empty result throws `not_found`.
- `blockUser`: update and delete sessions in one `transaction`.
- `deleteUser`, in one `transaction`, in this order:
  1. `SELECT id FROM user WHERE id = target FOR UPDATE`; no row throws `not_found`. The lock conflicts with the key-share lock a concurrent Zalo insert takes, so no transaction can slip in between steps 2 and 3 and trip `ON DELETE RESTRICT`.
  2. Delete all of the target's transactions, with no `deleted_at` filter.
  3. Delete the user row.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run --project db src/server/services/users.db.test.ts src/server/services/data-isolation.db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services
git commit -m "feat(users): add admin user management service"
```

---

## Task 5: `admin:grant` script

**Files:**

- Create: `scripts/admin-grant.ts`
- Modify: `package.json`, `README.md`

- [ ] **Step 1: Implement the script**

`package.json`: `"admin:grant": "node --env-file=.env.local scripts/admin-grant.ts"`.

The script runs under plain Node, so it cannot use `@/` aliases or `server-only`. Use `postgres` directly with `process.env.DATABASE_URL`.

- No argument: print usage and exit 1.
- `const email = process.argv[2].trim().toLowerCase()`, because better-auth stores emails lowercased.
- `UPDATE "user" SET role = 'admin' WHERE email = ${email} RETURNING email`.
- No row: print `No account for <email>. Sign in once first.` and exit 1.
- Success: print the email. Always `await sql.end()`, or the process hangs.

- [ ] **Step 2: Verify against the test database**

Run:

```bash
TEST_DB=postgres://postgres:postgres@localhost:5433/expense_test
docker exec -i expense-postgres psql -U postgres -d expense_test -c "INSERT INTO \"user\"(id,name,email) VALUES ('grant-check','G','grant@example.com') ON CONFLICT DO NOTHING"
DATABASE_URL=$TEST_DB pnpm admin:grant Grant@Example.com; echo "exit=$?"
DATABASE_URL=$TEST_DB pnpm admin:grant nobody@example.com; echo "exit=$?"
DATABASE_URL=$TEST_DB pnpm admin:grant; echo "exit=$?"
docker exec -i expense-postgres psql -U postgres -d expense_test -tc "SELECT role FROM \"user\" WHERE id='grant-check'; DELETE FROM \"user\" WHERE id='grant-check'"
```

Expected: `exit=0`, `exit=1`, `exit=1`, role `admin`. A shell `DATABASE_URL` wins over `.env.local`, which is how production is targeted.

- [ ] **Step 3: Document and commit**

Add one README line: run `pnpm admin:grant <email>` after first sign-in, and prefix `DATABASE_URL=…` to target production.

```bash
git add scripts/admin-grant.ts package.json README.md
git commit -m "feat(auth): add admin:grant script"
```

---

## Task 6: AI usage counter

**Files:**

- Create: `src/server/services/ai-usage.ts`, `src/server/services/ai-usage.db.test.ts`, `src/configs/env.test.ts`
- Modify: `src/configs/env.ts`, `src/app/api/cron/cleanup/route.ts`, `route.test.ts`, `.env.example`, `README.md`

**Interfaces:**

- Consumes: `aiUsage`, `user.role` from Task 1; `addDays` from `@/lib/dates`
- Produces:
  - `consumeAiCall(userId: string, today: string, limit: number = env().AI_DAILY_LIMIT): Promise<boolean>`. The third parameter is a test seam, following the repo's `now: Date = new Date()` pattern, because `env()` is cached.
  - `pruneAiUsage(today: string): Promise<void>`
  - `aiDailyLimit`, the zod schema exported from `@/configs/env`

- [ ] **Step 1: Write the failing tests**

`ai-usage.db.test.ts`, with `DAY = '2026-11-05'`:

```ts
it('allows calls up to the limit, then refuses', async () => {
  const u = await createTestUser();
  expect(await consumeAiCall(u.id, DAY, 2)).toBe(true);
  expect(await consumeAiCall(u.id, DAY, 2)).toBe(true);
  expect(await consumeAiCall(u.id, DAY, 2)).toBe(false);
});

it('cannot exceed the limit under concurrency', async () => {
  const u = await createTestUser();
  const results = await Promise.all(
    Array.from({ length: 10 }, () => consumeAiCall(u.id, DAY, 3)),
  );
  expect(results.filter(Boolean)).toHaveLength(3);
});

it('resets the next day', async () => {
  const u = await createTestUser();
  await consumeAiCall(u.id, DAY, 1);
  expect(await consumeAiCall(u.id, DAY, 1)).toBe(false);
  expect(await consumeAiCall(u.id, '2026-11-06', 1)).toBe(true);
});

it('counts users separately', async () => {
  const [a, b] = [await createTestUser(), await createTestUser()];
  await consumeAiCall(a.id, DAY, 1);
  expect(await consumeAiCall(b.id, DAY, 1)).toBe(true);
});

it('exempts admins without writing a row', async () => {
  const u = await createTestUser({ role: 'admin' });
  expect(await consumeAiCall(u.id, DAY, 0)).toBe(true);
  expect(await getDb().select().from(aiUsage)).toHaveLength(0);
});

it('prunes rows older than 7 days only', async () => {
  const u = await createTestUser();
  await getDb()
    .insert(aiUsage)
    .values([
      { userId: u.id, day: '2026-10-28', count: 1 },
      { userId: u.id, day: '2026-10-29', count: 1 },
    ]);
  await pruneAiUsage(DAY);
  const rows = await getDb().select().from(aiUsage);
  expect(rows.map((r) => r.day)).toEqual(['2026-10-29']);
});
```

`env.test.ts`:

```ts
it.each([
  [undefined, 100],
  ['', 100],
  ['5', 5],
])('aiDailyLimit(%s) = %s', (raw, want) =>
  expect(aiDailyLimit.parse(raw)).toBe(want),
);
it.each(['0', '-1', '1.5', 'abc'])('rejects %s', (raw) =>
  expect(aiDailyLimit.safeParse(raw).success).toBe(false),
);
```

`route.test.ts`: mock `@/server/services/ai-usage`. Assert `pruneAiUsage` is called once on success and not at all on 401.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/configs src/app/api/cron src/server/services/ai-usage.db.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

- `env.ts`: `export const aiDailyLimit = z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().positive().default(100));` and `AI_DAILY_LIMIT: aiDailyLimit` in the schema. Add a one-line comment saying why `''` is treated as unset.
- `consumeAiCall`: look up `role`; admins return true. Otherwise insert `{ userId, day: today, count: 1 }` with `.onConflictDoUpdate({ target: [aiUsage.userId, aiUsage.day], set: { count: sql`${aiUsage.count} + 1` }, where: lt(aiUsage.count, limit) }).returning(…)`, and return whether a row came back.
- `pruneAiUsage`: delete where `lt(aiUsage.day, addDays(today, -7))`.
- Cron route: after `pruneZaloData()`, `await pruneAiUsage(todayVn());`.
- `.env.example`: a commented line `# AI_DAILY_LIMIT=100`. README: one line for the optional var.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run src/configs src/app/api/cron src/server/services/ai-usage.db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/configs src/app/api/cron src/server/services .env.example README.md
git commit -m "feat(ai): add per-user daily AI usage counter"
```

---

## Task 7: Enforce the cap in smart entry and Zalo

**Files:**

- Modify: `src/server/services/smart-entry.ts`, `src/server/services/errors.ts`, `src/server/zalo/handler.ts`, `src/server/zalo/replies.ts`, `messages/en.json`, `messages/vi.json`
- Test: `src/features/tx-sheet/actions.test.ts`, `src/server/zalo/handler.test.ts`

**Interfaces:**

- Consumes: `consumeAiCall(userId, today)` from Task 6
- Produces: `ServiceErrorCode` gains `'ai_limit_reached'`; `REPLY.aiLimit`

- [ ] **Step 1: Write the failing tests**

Both test files add `vi.mock('@/server/services/ai-usage', () => ({ consumeAiCall: vi.fn() }))` and set `consumeAiCall` to resolve `true` in `beforeEach`.

`actions.test.ts`:

- `createQuickTxAction` with low-confidence text at the cap: `parseText` not called, `createTransaction` receives `KEYWORD_INPUT`, and the result is `ok: true`.
- `createQuickTxAction` with confident text: `consumeAiCall` not called.
- `scanReceiptAction` at the cap: result `{ ok: false, error: 'ai_limit_reached' }`, and neither `parseReceipt` nor `createTransactions` is called.
- With no categories, neither path calls `consumeAiCall`, because no AI call happens.
- `consumeAiCall` is called once for a multi-item receipt.

`handler.test.ts`:

```ts
it('replies the limit message for an image at the cap and saves nothing', async () => {
  vi.mocked(consumeAiCall).mockResolvedValue(false);
  await handleZaloUpdate(
    update({ event: 'image', photoUrl: 'https://x/y.jpg', text: null }),
    NOW,
  );
  expect(parseReceipt).not.toHaveBeenCalled();
  expect(createTransactions).not.toHaveBeenCalled();
  expect(sent()).toEqual([['C', REPLY.aiLimit]]);
});
```

Match the `update()` fields to the existing image tests. Add a text-at-the-cap case: `createTransaction` is called with the keyword input and the reply is `confirmReply(...)`, not an error.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/features/tx-sheet/actions.test.ts src/server/zalo/handler.test.ts`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

- `refineWithAi`: after the empty-categories check, `if (!(await consumeAiCall(userId, today))) return input;`
- `receiptToInputs`: after the empty-categories check, `if (!(await consumeAiCall(userId, today))) throw new ServiceError('ai_limit_reached');`
- `handler.ts` `handleImage`: wrap only the `receiptToInputs` call. Return `REPLY.aiLimit` for that `ServiceError` code and rethrow anything else, so other failures still reach `REPLY.error`.
- `REPLY.aiLimit`: `` `<p>${color('orange', '⚠ Hôm nay bạn đã hết lượt đọc ảnh')}</p><p>Mai thử lại, hoặc gõ tay giúp mình nhé</p>` ``
- `errors.ai_limit_reached`: en `You’ve reached today’s limit for reading images. Try again tomorrow or enter it by hand.`, vi `Hôm nay bạn đã hết lượt đọc ảnh, mai thử lại hoặc nhập tay giúp nhé`

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm vitest run src/features/tx-sheet src/server/zalo && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server src/features/tx-sheet messages
git commit -m "feat(ai): enforce the daily cap in text, receipts and Zalo"
```

---

## Task 8: Admin users page

**Files:**

- Create: `src/features/admin/actions.ts`, `src/features/admin/user-card.tsx`, `src/app/(main)/admin/users/page.tsx`
- Modify: `src/app/(main)/settings/page.tsx`, `messages/en.json`, `messages/vi.json`

**Interfaces:**

- Consumes: `requireAdmin()`, `defineAdminAction` from Task 3; `listUsers`, `setUserRole`, `blockUser`, `unblockUser`, `deleteUser`, `UserListItem` from Task 4
- Produces:
  - `setUserRoleAction({ id, role })`, `blockUserAction({ id })`, `unblockUserAction({ id })`, `deleteUserAction({ id })`
  - `<UserCard user={UserListItem} isSelf={boolean} />`

The UI has no unit tests in this repo. It is verified by typecheck and by driving it in Task 9.

- [ ] **Step 1: Implement the actions**

Follow `src/features/settings/actions.ts`: module-level `defineAdminAction` consts, exported `async function` wrappers (a `'use server'` file may only export async functions). Input: `z.object({ id: z.string().min(1) })`, plus `role: z.enum(USER_ROLES)` for the role action.

- [ ] **Step 2: Implement the page**

- `page.tsx`: `const { user } = await requireAdmin();` before anything else, then `listUsers()`. Container `mx-auto flex w-full max-w-[720px] flex-col gap-4`, `h1` with `nav.users`. Map to `<UserCard isSelf={u.id === user.id} />`. `generateMetadata` titled `nav.users`, as on the categories page.
- `settings/page.tsx`: when `user.role === 'admin'`, add a second `Link` to `/admin/users` in the existing card, styled exactly like the Categories row, with the lucide `Users` icon and `tNav('users')`.

- [ ] **Step 3: Implement `user-card.tsx`** (client)

- Card classes from `category-card.tsx`. Row: `UserAvatar`, then a `min-w-0 flex-1` column so long names and emails `truncate` on narrow phones.
- Name, email, and a meta line with `Chip`s for role and status plus the join date. Format dates with next-intl `useFormatter().dateTime(user.createdAt, { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' })`. The fixed time zone prevents a hydration mismatch.
- `isSelf`: show a "You" chip and no menu.
- Otherwise a HeroUI `Dropdown` with an icon-only trigger (`aria-label` from `admin.users.actions`), `Dropdown.Popover`, `Dropdown.Menu onAction`, and items:
  - role toggle: Make admin or Remove admin
  - Block or Unblock
  - Delete, with `variant="danger"`
- Role toggle and Unblock run immediately. Block and Delete open a single `AlertDialog`, copied from `category-card.tsx` with its `inFlight` ref and `slot="close"` cancel. Hold `confirming: 'block' | 'delete' | null` in state.
- Error handling follows `category-card.tsx`'s `remove`: `t('errors.' + code)` toast, `errors.unknown` on throw, and a success toast. The `refresh()` in `defineAdminAction` updates the list.

- [ ] **Step 4: Add messages** under a new `admin.users` namespace, plus `nav.users`

| Key                                                 | en                                                                       | vi                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `nav.users`                                         | Users                                                                    | Người dùng                                                                                   |
| `you`                                               | You                                                                      | Bạn                                                                                          |
| `actions`                                           | User actions                                                             | Thao tác                                                                                     |
| `roleAdmin` / `roleUser`                            | Admin / User                                                             | Quản trị / Người dùng                                                                        |
| `statusActive` / `statusBlocked`                    | Active / Blocked                                                         | Hoạt động / Đã khóa                                                                          |
| `joined`                                            | Joined {date}                                                            | Tham gia {date}                                                                              |
| `makeAdmin` / `removeAdmin`                         | Make admin / Remove admin                                                | Cấp quyền quản trị / Gỡ quyền quản trị                                                       |
| `block` / `unblock` / `delete`                      | Block / Unblock / Delete                                                 | Khóa / Mở khóa / Xóa                                                                         |
| `blockTitle`                                        | Block {name}?                                                            | Khóa {name}?                                                                                 |
| `blockBody`                                         | They’ll be signed out and can’t use the app or Zalo bot until unblocked. | Người này sẽ bị đăng xuất và không dùng được ứng dụng hay bot Zalo cho đến khi được mở khóa. |
| `deleteTitle`                                       | Delete {name}?                                                           | Xóa {name}?                                                                                  |
| `deleteBody`                                        | All of {name}’s data will be removed. This can’t be undone.              | Toàn bộ dữ liệu của {name} sẽ bị xóa. Không thể hoàn tác.                                    |
| `roleChanged` / `blocked` / `unblocked` / `deleted` | Role updated / User blocked / User unblocked / User deleted              | Đã đổi quyền / Đã khóa / Đã mở khóa / Đã xóa                                                 |

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all clean. `NAV_ITEMS` is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin "src/app/(main)" messages
git commit -m "feat(admin): add user management page"
```

---

## Task 9: Full verification

**Files:** none expected. Any fix found here gets its own commit.

- [ ] **Step 1: Run the CI sequence**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all pass. `pnpm build` must succeed without `ALLOWED_EMAILS` in the environment.

- [ ] **Step 2: Manual check on `pnpm dev` with two Google accounts**

Run `pnpm db:migrate` against local dev first, then confirm each of these:

1. A new Google account signs in, lands as `user`, and has default categories.
2. As that user, `/admin/users` shows the not-found page, and Settings has no Users row.
3. Grant the other account with `pnpm admin:grant`. Settings shows Users, and the page shows "You" on that row with no menu.
4. On a phone-width viewport, the list is readable and a long email truncates.
5. Block the user: their next request lands on `/login`. Signing in again shows the blocked error via `/login?error=blocked`.
6. If a Zalo account is linked, the bot answers "not linked" while blocked.
7. Unblock: sign-in and the Zalo bot both work again.
8. Delete the user, then sign in with that account: a new, empty account appears.

Report anything that could not be exercised, such as Zalo without a tunnel, rather than marking it done.

- [ ] **Step 3: Check the rollout notes**

The Rollout section of the spec is the deployment checklist and needs no code. Confirm README no longer mentions `ALLOWED_EMAILS`. Do not run production steps from this plan; they are the owner's to run.
