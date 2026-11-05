# Open sign-up, roles and user management

Date: 2026-11-05
Status: awaiting review

## Goal

Let anyone with a Google account use Sổ Chi without editing `ALLOWED_EMAILS`, and give admins a way to see and manage users. The audience is friends and family, not a public launch.

**Done when:**

- A Google account that has never used the app can sign in and lands as role `user`.
- An admin can list users, change roles, block, unblock and delete accounts from their phone.
- A non-admin cannot reach any of that, by UI or by direct call.
- A blocked user is locked out of the app and the Zalo bot on their next request.
- One user's AI use is capped per day, without stopping them recording expenses by text.

## Decisions

| Topic          | Decision                                                               |
| -------------- | ---------------------------------------------------------------------- |
| Login          | Google only, unchanged                                                 |
| Roles          | `admin`, `user`; new accounts are `user`                               |
| Data access    | Users see only their own data; admins see the user list, not user data |
| Admin powers   | List, promote/demote, block/unblock, delete                            |
| Implementation | Thin custom layer on better-auth, not its `admin` plugin, and not CASL |
| AI limit       | Per-user daily cap, default 100, admins exempt                         |
| First admin    | `pnpm admin:grant <email>` script                                      |

The `admin` plugin was rejected because it publishes about 15 endpoints under `/api/auth/admin/*`, including `impersonate-user` and `set-user-password`, and its `set-role` has no self-demotion check. Each would have to be disabled individually through `disabledPaths`. CASL is unnecessary for two roles and one page.

## Data model

Additive migration:

**`user`**

- `role`: text, not null, default `'user'`. Application type: `'admin' | 'user'`.
- `blocked_at`: timestamp with time zone, nullable. Null means active.

Both are declared in better-auth's `user.additionalFields` with `input: false`, so clients cannot set them, and so they are present on `session.user`.

**`ai_usage`** (new)

- `user_id`: text, not null, references `user.id` on delete cascade.
- `day`: date, not null.
- `count`: integer, not null, default 0.
- Primary key: `(user_id, day)`.

## Access control

### Removing the allowlist

Delete `src/server/auth/allowlist.ts`, its test, the `ALLOWED_EMAILS` env key, its `.env.example`, `README.md` and `src/test/setup-env.ts` entries, and the `not_invited` error and translations.

Rename `getAllowedSession` to `getActiveSession`, and `findAllowedUserIdByZaloId` to `findActiveUserIdByZaloId`.

### Blocking

Blocked checks replace allowlist checks at the same points:

| Location                   | Behaviour                                                                 |
| -------------------------- | ------------------------------------------------------------------------- |
| `user.create.before`       | Hook removed; a new account cannot already be blocked                     |
| `session.create.before`    | Throws `blocked`; login shows the error via `/login?error=blocked`        |
| `getActiveSession`         | Rejects and deletes the session row, keeping the existing no-loop pattern |
| `requireSession`           | Redirects to `/login?error=blocked`                                       |
| `findActiveUserIdByZaloId` | Returns null, so the bot sends its existing "not linked" reply            |

The `findUserEmail` hook dependency becomes a lookup of `blocked_at`. The Zalo link is kept on block, so unblocking restores the bot.

`classifySession` takes a session and returns `ok`, `none` or `blocked`. `AppSession['user']` gains `role`.

### Admin guard

- `requireAdmin()` in `src/server/auth/session.ts` calls `requireSession()`, then `notFound()` for non-admins, so the page is not advertised.
- `defineAdminAction()` in `src/server/action.ts` applies the same check before running a handler, and passes the actor's id. A non-admin receives `{ ok: false, error: 'forbidden' }`.

### First admin

`scripts/admin-grant.ts`, run as `pnpm admin:grant <email>`, sets `role = 'admin'` on an existing account and exits non-zero if the email has no account. It follows the `zalo:webhook` pattern, using `node --env-file=.env.local`. A shell `DATABASE_URL` overrides the file, which is how it targets production. It is also the recovery path if admin access is lost.

## Admin operations

### Service

`src/server/services/users.ts`:

| Function                               | Behaviour                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `listUsers()`                          | All users, newest first: id, name, email, image, role, blockedAt, createdAt |
| `setUserRole(actorId, targetId, role)` | Updates `role`                                                              |
| `blockUser(actorId, targetId)`         | Sets `blocked_at` and deletes the target's sessions in one transaction      |
| `unblockUser(actorId, targetId)`       | Clears `blocked_at`                                                         |
| `deleteUser(actorId, targetId)`        | Deletes the target's transactions, then the user row, in one transaction    |

Rules, enforced in the service:

- `actorId === targetId` throws `ServiceError('cannot_modify_self')`.
- A missing target throws `ServiceError('not_found')`.
- Admins may act on other admins. Because nobody can act on themselves, the acting admin always remains, so at least one admin always exists.

`deleteUser` removes transactions explicitly because `transactions.category_id` is `ON DELETE RESTRICT`. Relying on the cascade from `user` would remove categories while transactions still reference them. Categories, Zalo links, sessions, accounts and `ai_usage` then cascade from the user row.

Delete does not prevent return: with open sign-up, a deleted person can sign in again and get a new empty account. Block is the way to keep someone out. Receipt images already stored in R2 for a deleted user are not removed, matching the known orphan-object behaviour.

### Page

- Route: `src/app/(main)/admin/users/page.tsx`, guarded by `requireAdmin()`.
- Entry point: a "Users" row on the Settings page, rendered only for admins. It is not added to `NAV_ITEMS`, which would add a fifth item to the mobile tab bar.
- Layout: a card list that works on mobile, showing avatar, name, email, role, status and join date.
- No search or pagination.
- The admin's own row is labelled "You" and has no actions.
- Each other row has a menu with Make admin or Remove admin, Block or Unblock, and Delete.
- Block and Delete use a confirmation dialog. Delete names the person and states it cannot be undone.
- Errors show through the existing toast. All strings go in `messages/en.json` and `messages/vi.json`.

## AI daily cap

`src/server/services/ai-usage.ts` exports `consumeAiCall(userId, today): Promise<boolean>`.

- Returns true without counting when the user is an admin.
- Otherwise runs one atomic `INSERT ... ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1 WHERE count < limit RETURNING`. A returned row means allowed.
- `today` comes from the existing `todayVn()`, so the count resets at midnight Vietnam time.
- The limit comes from optional env `AI_DAILY_LIMIT`, a positive integer defaulting to 100.
- A call counts before OpenAI runs, so failed calls count too. This bounds retry loops.

Call sites in `src/server/services/smart-entry.ts`:

- `refineWithAi`: when not allowed, returns the keyword-based input unchanged. Same outcome as an AI failure today.
- `receiptToInputs`: when not allowed, throws `ServiceError('ai_limit_reached')`. One image is one call, however many items it contains.

| Input                               | Result at the cap                                                |
| ----------------------------------- | ---------------------------------------------------------------- |
| Text with a confident keyword match | Saved normally; AI is not involved                               |
| Text that would need AI             | Saved from the keyword result, with no error                     |
| App receipt image                   | `ai_limit_reached` toast; nothing saved                          |
| Zalo receipt image                  | New "limit reached, try again tomorrow" bot reply; nothing saved |

The Zalo handler catches `ai_limit_reached` and sends the new reply in `vi`, matching existing replies.

`/api/cron/cleanup` also deletes `ai_usage` rows older than 7 days.

## Login page

The `not_invited` error key is replaced by `blocked`, in both locales. Any other error value keeps showing `google_login_failed`.

## Testing

Written test-first.

- **Updated:** `hooks.test.ts`, `session.test.ts`, `src/test/setup-env.ts`, the Zalo handler and link tests. `allowlist.test.ts` is removed.
- **`users.db.test.ts`:** delete succeeds for a user with transactions and nested categories; block removes sessions; unblock restores access; self-actions rejected; missing target rejected.
- **`defineAdminAction`:** a non-admin receives `forbidden` and the handler does not run.
- **`ai-usage.db.test.ts`:** stops at the limit; concurrent calls cannot exceed it; resets the next day; admins exempt.
- **`smart-entry`:** text at the cap returns the keyword input; a receipt at the cap throws `ai_limit_reached`.
- **Data isolation:** user B cannot read or change user A's transactions or categories.
- **Zalo:** a blocked user gets "not linked"; an image at the cap gets the limit reply.
- **Manual:** with a second Google account, confirm sign-up as `user`, 404 on `/admin/users`, then block, unblock and delete.

## Rollout

1. In Google Cloud Console, confirm the OAuth consent screen is published. In Testing mode, only listed test users can sign in, which would defeat open sign-up.
2. Run `pnpm db:migrate` against production. The migration is additive, so the running version keeps working.
3. Deploy.
4. Sign in, then run `pnpm admin:grant` for the owner's account.
5. Remove `ALLOWED_EMAILS` from Vercel. Optionally set `AI_DAILY_LIMIT`.

## Out of scope

- Email/password login
- Audit log of admin actions
- Per-user AI usage in the admin list
- Privacy and terms pages
- Search and pagination in the admin list
- Permanently banning an email address after deletion
- Impersonation
