# Sổ Chi Phase 3 — Zalo Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link a Zalo account from Settings, then tag the bot in a group (or message it 1-1) with text or a receipt photo to log transactions into the tagger's personal ledger, with `/undo`, and show those transactions (with receipts) in the app.

**Architecture:** `POST /api/zalo/webhook` is a thin shell: check secret → dedupe on `message_id` → return 200 → run `handleZaloUpdate()` inside `after()`. The handler (`src/server/zalo/`) classifies the message and calls pure services (`src/server/services/`), the AI module (`src/server/ai/`) and R2 storage. Text goes through the same parse path as app quick entry (`parseQuick` → `resolveCategorySlug`); Claude is only consulted for low-confidence text and for receipts. Receipts are viewed in the app through an authenticated redirect route to a short-lived R2 signed URL.

**Tech Stack:** Next.js 16.4 App Router (`after()` from `next/server`), Drizzle + Postgres, `@anthropic-ai/sdk` 1.3 (`client.beta.messages.parse` + `betaZodOutputFormat`), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (new), zod 4, HeroUI v3, next-intl, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-03-so-chi-mvp-design.md` (Phase 3 = §12; bot §8; Claude §9; data model §5 Zalo tables; UI §7 Settings/Tổng quan/Giao dịch). Zalo payload sample captured from the real bot: `docs/zalo/bot.md` (commit it in Task 1).

## Zalo Bot Platform facts (verified against https://bot.zapps.me/docs, 2026-11-03)

- API: `POST https://bot-api.zaloplatforms.com/bot<ZALO_BOT_TOKEN>/<method>`, JSON body, response `{ ok, result, description?, error_code? }`.
- `sendMessage { chat_id, text, parse_mode? }`; `text` 1–2000 chars. No reply/quote parameter. `parse_mode: 'html'` supports `<b> <strong> <i> <em> <u> <s> <del> <strike> <h1>–<h6> <ul> <ol> <li> <p> <div>` and `style="…"` (font-size, font-weight, font-style, text-decoration, palette colors only). Nothing else (no `<a>`, no `<br>`), so any user/category text inside a reply must be HTML-escaped.
- `setWebhook { url, secret_token }` (secret 8–256 chars). Every webhook call carries header `X-Bot-Api-Secret-Token: <secret_token>`.
- Webhook body: `event_name` ∈ `message.text.received | message.image.received | message.sticker.received | message.voice.received | message.unsupported.received`, plus `message { message_id, date, message_type, from { id, display_name, is_bot }, chat { id, chat_type: 'PRIVATE' | 'GROUP' }, text? , photo_url?, caption? }`. The docs show this bare; the capture in `docs/zalo/bot.md` shows it wrapped as `{ ok, result: { message, event_name } }` — accept both.
- No top-level update id: `message.message_id` is the dedupe key (stored in `zalo_updates.update_id`).
- In the capture, a PRIVATE chat has `chat.id ≠ from.id`. Identity = `from.id`; replies go to `chat.id`.
- Group events fire only when the bot is @-mentioned; there is no mention field, the mention is plain text `@<bot display name>` inside `text`. `getMe` does not return the display name.
- **One fixed bot.** The app talks to exactly one bot, identified by `ZALO_BOT_TOKEN`. Its display name is a code constant `ZALO_BOT_NAME = 'Sổ Chi'` in `src/server/zalo/config.ts` (next to `ZALO_API_BASE = 'https://bot-api.zaloplatforms.com'` and `zaloApiUrl(method)`, which builds the URL from `env().ZALO_BOT_TOKEN`). No bot-name env, no per-user or per-group bot config.

## Global Constraints

- Read before writing Next code: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`, and the route-handler doc under `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`. HeroUI component docs via `node .agents/skills/heroui-react/scripts/get_component_docs.mjs <name>`.
- Data access in pages/actions/routes only via `requireSession()` / `getAllowedSession()` (`src/server/auth/session.ts`). Server actions via `defineAction(schema, handler, { refresh? })` (`src/server/action.ts`); `'use server'` files export only async wrappers.
- Every service function takes `userId` first (except lookups keyed by Zalo id / link code, which return a `userId`) and filters by it; every `transactions` read filters `deletedAt IS NULL`.
- Services and `src/server/zalo/*`, `src/server/ai/*` import nothing from `next/*`.
- Bot replies are always Vietnamese, copied verbatim from spec §8 where the spec gives them (exact strings in Task 6).
- "Today" = `todayVn()`; the bot never trusts a date from Claude that is invalid or after today (→ today).
- Claude: model constant `AI_MODEL = 'claude-opus-5-5'`; every call uses `client.beta.messages.parse({ model: AI_MODEL, max_tokens: 2048, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low', format: betaZodOutputFormat(schema) }, ... })`, no `thinking` param, no `temperature`. Check `stop_reason === 'refusal'` (→ `null`) before reading `parsed_output`.
- Receipt images (from Zalo only; the app has no receipt upload in this phase): ≤ 10 MB (10 × 1024 × 1024 bytes); media type one of `image/jpeg | image/png | image/gif | image/webp`, always sniffed from bytes.
- Webhook always answers quickly; failing to send a reply is logged, never retried, never thrown.
- Copy in `messages/vi.json` + `messages/en.json`; money via `<Money>` / `formatSignedVnd`; icons lucide `strokeWidth={1.75}`.
- Repo files are CRLF; format with oxfmt (`pnpm format`), never prettier. Comments only for non-obvious WHY.
- Local DB: docker compose `expense-postgres` on port 5433; DB tests are `*.db.test.ts`.

## Review Focus

1. **Wrapped vs bare webhook body** — a body shaped like `docs/zalo/bot.md` (`{ ok, result: { message, event_name } }`) and the documented bare shape must both parse to the same `ZaloUpdate`. Pinned in Task 6 (`parses wrapped and bare bodies`).
2. **`chat.id ≠ from.id` in private chats** — linking and user lookup must use `from.id`, replies must go to `chat.id`. Pinned in Task 7 (`links by from.id and replies to chat.id`).
3. **HTML in user text** — a note, store or category name like `<b>x</b> & <script>` must appear literally in the bot reply (escaped `&lt;b&gt;x&lt;/b&gt; &amp; &lt;script&gt;`), never break the reply markup. Pinned in Task 6 (`escapes user text in html replies`).
4. **Zalo CDN serving `application/octet-stream` or no `content-length`** — the media type must be sniffed from magic bytes, and a body streaming past 10 MB must abort as `too_large` without buffering it all. Pinned in Task 4.
5. **Relinking** — a Zalo account redeeming a code for a different app user, or an already-linked user redeeming a new code from another Zalo account, must leave exactly one link per user and per Zalo id (latest wins); a used code and a code superseded by a newer one are both rejected. Pinned in Task 2.

---

## File Structure

```
src/server/db/schema/zalo.ts          zalo_links, zalo_link_codes, zalo_updates
src/server/services/
  zalo-link.ts (+db test)             link codes, redeem, lookup, unlink, dedupe, prune
  transactions.ts (+db test)          + receiptKey on create, undoLatestZaloTransaction
  quick-entry.ts (+db test)           quickParseToInput (shared by app action and bot)
  receipts.ts (+test)                 R2 put/delete/signed URL
src/server/ai/
  client.ts  config.ts                lazy Anthropic client, AI_MODEL
  categories.ts (+test)               aiCategoryOptions, normalizeAiDate
  parse-text.ts  parse-receipt.ts (+test)
src/server/zalo/
  update.ts (+test)                   parseZaloUpdate, stripMention, classify
  replies.ts (+test)                  Vietnamese reply strings + confirm formatter
  config.ts                           ZALO_BOT_NAME, zaloApiUrl (one fixed bot)
  client.ts (+test)                   sendMessage (parse_mode html)
  download.ts (+test)                 downloadImage (size cap, sniffing)
  handler.ts (+test)                  handleZaloUpdate
src/app/api/zalo/webhook/route.ts (+test)
src/app/api/cron/cleanup/route.ts (+test)
src/app/api/receipts/[id]/route.ts
src/features/settings/zalo-link-card.tsx, actions.ts
src/features/home/zalo-card.tsx       linked state
scripts/zalo-set-webhook.ts
```

---

### Task 1: Env, proxy, Zalo tables + migration

**Files:**

- Modify: `src/configs/env.ts`, `.env.example`, `src/proxy.ts`, `src/proxy.test.ts`, `src/server/db/schema/index.ts`
- Create: `src/server/db/schema/zalo.ts`, migration `src/server/db/migrations/0001_zalo.sql` (generated)
- Add to git: `docs/zalo/bot.md`
- Test: `src/server/db/schema.db.test.ts` (extend)

**Interfaces:**

- Produces: `env().ZALO_BOT_TOKEN | ZALO_WEBHOOK_SECRET | ANTHROPIC_API_KEY | R2_* | CRON_SECRET` now `string` (required). Tables `zaloLinks`, `zaloLinkCodes`, `zaloUpdates` exported from `@/server/db/schema`.

- [ ] **Step 1: Write failing tests**

In `proxy.test.ts` add `'/api/cron/cleanup'` to the public-path `it.each`. In `schema.db.test.ts` add `it('cascades zalo rows when the user is deleted')`: create user, insert a `zalo_links` row and a `zalo_link_codes` row for it, delete the user, expect both tables empty for that user.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/proxy.test.ts src/server/db/schema.db.test.ts`
Expected: FAIL (cron path redirected; `zaloLinks` not exported).

- [ ] **Step 3: Implement**

- `env.ts`: drop `optional(...)` and the "Phase 3 keys" comment from the Zalo/Anthropic/R2/CRON keys (keep the 8–256 comment). `.env.example`: change the Zalo comment to `# The one Sổ Chi bot (Zalo Bot Creator) — its token`.
- `proxy.ts`: `PUBLIC_PREFIXES = ['/api/auth/', '/api/zalo/', '/api/cron/']`.
- `schema/zalo.ts` (spec §5):
  - `zaloLinks = pgTable('zalo_links', { zaloUserId: text('zalo_user_id').primaryKey(), userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }), displayName: text('display_name').notNull(), linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow() })`
  - `zaloLinkCodes = pgTable('zalo_link_codes', { code: text('code').primaryKey(), userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }), expiresAt: timestamptz notNull, usedAt: timestamptz nullable }, (t) => [index('zalo_link_codes_user').on(t.userId)])`
  - `zaloUpdates = pgTable('zalo_updates', { updateId: text('update_id').primaryKey(), receivedAt: timestamptz notNull defaultNow })`
  - export `type ZaloLink = typeof zaloLinks.$inferSelect`; re-export from `schema/index.ts`.
- Run `pnpm db:generate --name zalo` and `pnpm db:migrate` (dev DB). Convert the generated SQL to CRLF like `0000_init.sql`.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run src/proxy.test.ts src/server/db/schema.db.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/configs/env.ts .env.example src/proxy.ts src/proxy.test.ts src/server/db docs/zalo/bot.md
git commit -m "feat(zalo): zalo tables, required bot env, public cron path"
```

---

### Task 2: Zalo link + dedupe services

**Files:**

- Create: `src/server/services/zalo-link.ts`
- Test: `src/server/services/zalo-link.db.test.ts`

**Interfaces:**

- Consumes: tables from Task 1.
- Produces:
  - `LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'` (A–Z0–9 minus `0 O 1 I L`), codes length 6, TTL 10 min.
  - `createLinkCode(userId: string, now?: Date): Promise<{ code: string; expiresAt: Date }>` — deletes the user's unused codes first; generated with `crypto.randomInt`; retries on pk collision (max 3).
  - `redeemLinkCode(input: { code: string; zaloUserId: string; displayName: string }, now?: Date): Promise<{ userId: string; userName: string } | null>` — code trimmed + uppercased; valid = exists, `usedAt` null, `expiresAt > now`. In one transaction, lock the code row (`for update`), set `usedAt = now`, delete any `zalo_links` row with that `zaloUserId` or that `userId`, insert the new link. `null` when invalid.
  - `getZaloLink(userId: string): Promise<{ displayName: string; linkedAt: Date } | null>`
  - `unlinkZalo(userId: string): Promise<void>` (idempotent)
  - `findUserIdByZaloId(zaloUserId: string): Promise<string | null>`
  - `markUpdateSeen(updateId: string): Promise<boolean>` — `insert … on conflict do nothing returning`; `true` if new.
  - `pruneZaloData(now?: Date): Promise<void>` — delete `zalo_updates` with `receivedAt < now − 7 days` and `zalo_link_codes` with `expiresAt < now − 1 day`.

- [ ] **Step 1: Write the failing tests** (`now` passed explicitly; `resetDb()` in `beforeEach`)

```ts
it('creates a 6-char code from the alphabet expiring in 10 minutes');
// /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/, expiresAt = now + 600_000
it('invalidates the previous unused code when a new one is created');
// redeem(oldCode) → null; redeem(newCode) → { userId }
it('redeems case-insensitively with surrounding spaces'); // ` abc123 ` style input
it('rejects expired, used and unknown codes'); // now + 10min + 1ms → null; second redeem → null
it('keeps one link per user and per zalo id, latest wins');
// userA links zalo Z1; userB redeems with Z1 → findUserIdByZaloId(Z1) = B, getZaloLink(A) = null
// userB redeems a new code with Z2 → findUserIdByZaloId(Z1) = null, (Z2) = B
it('unlinks and reports no link');
it('markUpdateSeen returns true once then false');
it('prunes old updates and long-expired codes only');
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/server/services/zalo-link.db.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** the functions above in `zalo-link.ts`. `redeemLinkCode` returns the app user's `name` (join `user`) for the reply.
- [ ] **Step 4: Run to verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(zalo): link code, redeem and dedupe services"`

---

### Task 3: Transaction additions + shared quick-entry path

**Files:**

- Modify: `src/server/services/transactions.ts`, `src/features/tx-sheet/actions.ts`
- Create: `src/server/services/quick-entry.ts`
- Test: `src/server/services/transactions.db.test.ts` (extend), `src/server/services/quick-entry.db.test.ts`

**Interfaces:**

- Consumes: `parseQuick`/`QuickParse` (`src/lib/parse-quick.ts`), `resolveCategorySlug`, `txInputSchema` (`src/features/tx-sheet/schema.ts`, pure zod).
- Produces:
  - `createTransaction(userId, input: TxInput, source: 'app' | 'zalo' = 'app', receiptKey: string | null = null): Promise<TxView>`
  - `UNDO_WINDOW_MS = 10 * 60 * 1000`; `undoLatestZaloTransaction(userId: string, now?: Date): Promise<TxView | null>` — newest (by `createdAt`) non-deleted `source = 'zalo'` row of the user with `createdAt >= now − UNDO_WINDOW_MS`; soft-deletes it and returns its view (read before deleting); `null` if none.
  - `quickParseToInput(userId: string, parsed: QuickParse): Promise<TxInput>` — `resolveCategorySlug(userId, parsed.categorySlug, parsed.type)` then `txInputSchema.safeParse`; throws `ServiceError('invalid_input')` on failure.

- [ ] **Step 1: Write the failing tests**

```ts
// transactions.db.test.ts
it('stores receiptKey and source zalo');
it('undo deletes only the newest zalo tx within 10 minutes');
// app tx (newer) ignored; zalo tx created 11 min before `now` → null; two zalo txs → newest deleted, other untouched
it('undo never touches another user'); // userB's recent zalo tx; undo(userA) → null
// quick-entry.db.test.ts
it('maps a parse to the user category for its slug'); // parseQuick('grab 32k', '2026-10-14') → categoryId of move.grab
it('falls back to shop.goods when the slug category was deleted');
```

Insert old rows with an explicit `createdAt` to control time.

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/server/services/transactions.db.test.ts src/server/services/quick-entry.db.test.ts` → FAIL.
- [ ] **Step 3: Implement**; refactor `createQuick` in `src/features/tx-sheet/actions.ts` to `createTransaction(userId, await quickParseToInput(userId, parsed))` (keep the server re-parse with `todayVn()` and its comment).
- [ ] **Step 4: Run to verify pass** — `pnpm test` (all, incl. existing action tests) → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(tx): zalo undo, receipt key, shared quick-entry input"`

---

### Task 4: R2 receipts, image download, receipt view route

**Files:**

- Create: `src/server/services/receipts.ts`, `src/server/zalo/download.ts`, `src/app/api/receipts/[id]/route.ts`
- Test: `src/server/services/receipts.test.ts`, `src/server/zalo/download.test.ts`
- Modify: `package.json` (`pnpm add @aws-sdk/s3-request-presigner`)

**Interfaces:**

- Produces:
  - In `src/server/services/receipts.ts`: `type ReceiptMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'`, `MAX_ZALO_IMAGE_BYTES = 10 * 1024 * 1024`
  - `downloadImage(url: string): Promise<{ ok: true; bytes: Buffer; mediaType: ReceiptMediaType } | { ok: false; error: 'too_large' | 'failed' }>` — `fetch` with `AbortSignal.timeout(15_000)`; non-2xx/throw → `failed`; `content-length > MAX` → `too_large` without reading; otherwise read the body stream, abort and return `too_large` as soon as the running total exceeds MAX; media type via `sniffMediaType`, unknown → `failed`.
  - `sniffMediaType(bytes: Uint8Array): ReceiptMediaType | null` in `receipts.ts` — magic bytes `FF D8 FF` jpeg, `89 50 4E 47` png, `47 49 46 38` gif, `RIFF....WEBP` webp.
  - `putReceipt(userId: string, bytes: Buffer, mediaType: ReceiptMediaType): Promise<string>` — key `receipts/{userId}/{randomUUID()}.{jpg|png|gif|webp}`, `PutObjectCommand` with `ContentType`.
  - `deleteReceipt(key: string): Promise<void>` (logs and swallows errors)
  - `receiptUrl(key: string): Promise<string>` — `getSignedUrl(GetObjectCommand, { expiresIn: 300 })`.
  - S3 client lazily built: `new S3Client({ region: 'auto', endpoint: \`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com\`, credentials: { accessKeyId, secretAccessKey } })`.
  - Route `GET /api/receipts/[id]`: `getAllowedSession()` status ≠ `ok` → 401; `id` not a uuid → 404; `getTransaction(userId, id)` (`ServiceError` → 404) with `receiptKey` null → 404; else `302` to `receiptUrl(key)` with `Cache-Control: private, no-store`.

- [ ] **Step 1: Write failing tests** (mock `fetch` with `vi.stubGlobal`; mock `@aws-sdk/client-s3` `S3Client.prototype.send` with `vi.spyOn`)

```ts
it('sniffs jpeg served as application/octet-stream'); // body FF D8 FF E0 …, no content-length → { ok, mediaType: 'image/jpeg' }
it('rejects by content-length without reading the body');
it('aborts a stream that passes 10 MB'); // ReadableStream of 1 MB chunks, 11 chunks, no content-length → too_large; assert < 11 chunks pulled
it('fails on non-image bytes and on HTTP errors');
it('putReceipt writes under receipts/{userId}/ with the media type'); // key matches /^receipts\/u1\/[0-9a-f-]{36}\.png$/, ContentType 'image/png'
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/server/zalo/download.test.ts src/server/services/receipts.test.ts` → FAIL.
- [ ] **Step 3: Implement** the three files above.
- [ ] **Step 4: Run to verify pass** — same command + `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(receipts): r2 storage, capped image download, signed view route"`

---

### Task 5: Claude parsing (`parseText`, `parseReceipt`)

**Files:**

- Create: `src/server/ai/config.ts`, `src/server/ai/client.ts`, `src/server/ai/categories.ts`, `src/server/ai/parse-text.ts`, `src/server/ai/parse-receipt.ts`
- Test: `src/server/ai/categories.test.ts`, `src/server/ai/parse.test.ts`

**Interfaces:**

- Consumes: `CategoryNode` (`listCategories`), `ReceiptMediaType` (Task 4).
- Produces:
  - `AI_MODEL = 'claude-opus-5-5'`; `getAnthropic(): Anthropic` (lazy singleton, `apiKey: env().ANTHROPIC_API_KEY`).
  - `type AiCategory = { id: string; name: string; parentName: string | null; type: TxType }`; `aiCategoryOptions(nodes: CategoryNode[]): AiCategory[]` — every child, plus roots that have no children.
  - `normalizeAiDate(date: string | null | undefined, today: string): string` — valid `YYYY-MM-DD` calendar date ≤ today, else `today`.
  - `parseText(text: string, ctx: { today: string; categories: AiCategory[] }): Promise<{ type: TxType; amount: number; categoryId: string; store: string | null; note: string | null; date: string } | null>`
  - `parseReceipt(image: Buffer, mediaType: ReceiptMediaType, ctx: same): Promise<{ isReceipt: boolean; total: number | null; store: string | null; date: string; categoryId: string | null; note: string | null } | null>`
  - Both: `null` on `stop_reason === 'refusal'` or `parsed_output == null`; `type` is taken from the chosen category (not from the model); `date` through `normalizeAiDate`; API errors propagate (caller decides).
- Request shape (both) — see Global Constraints. Output schemas use `z.enum(categoryIds)` for `categoryId` (nullable in the receipt schema). Prompt text is Vietnamese-aware English: system prompt says it extracts one VND expense/income from a Vietnamese chat message (or receipt photo), lists categories as `id — Parent › Child (out|in)` lines, gives today's date for relative words ("hôm qua"), says amounts are integers in VND ("45k" = 45000, "1,5tr" = 1500000), and for receipts: `isReceipt` false for non-receipts, `total` = grand total actually paid, `note` = short item summary like `Phở bò, trà đá ×2`, `date` null when unreadable. Image goes as `{ type: 'image', source: { type: 'base64', media_type, data } }` before the text block.

- [ ] **Step 1: Write failing tests** (`vi.mock('./client')` returning `{ beta: { messages: { parse: vi.fn() } } }`)

```ts
it('aiCategoryOptions lists children and childless roots only');
it(
  'normalizeAiDate keeps past dates and replaces future/invalid ones with today',
);
// ('2026-10-13','2026-10-14') → '2026-10-13'; '2026-10-15' → today; '2026-02-30' → today; null → today
it('parseText sends model, low effort, default fallbacks and the beta');
// expect parse called with objectContaining({ model: 'claude-opus-5-5', fallbacks: 'default',
//   betas: ['server-side-fallback-2026-07-01'], output_config: objectContaining({ effort: 'low' }) })
it('parseText takes type from the chosen category'); // model picks an 'in' category → type 'in'
it('returns null on refusal and on missing parsed_output');
it('parseReceipt sends the image as base64 before the text');
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/server/ai` → FAIL.
- [ ] **Step 3: Implement** (check `betaZodOutputFormat` import path `@anthropic-ai/sdk/helpers/beta/zod` and the `fallbacks: 'default'` type against `node_modules/@anthropic-ai/sdk` before writing).
- [ ] **Step 4: Run to verify pass** — `pnpm vitest run src/server/ai && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(ai): claude text and receipt parsing"`

---

### Task 6: Zalo bot config, update parsing, HTML replies, send client

**Files:**

- Create: `src/server/zalo/config.ts`, `src/server/zalo/update.ts`, `src/server/zalo/replies.ts`, `src/server/zalo/client.ts`
- Test: `src/server/zalo/update.test.ts`, `src/server/zalo/replies.test.ts`, `src/server/zalo/client.test.ts`

**Interfaces:**

- Produces:
  - `type ZaloUpdate = { messageId: string; chatId: string; chatType: 'PRIVATE' | 'GROUP'; fromId: string; fromName: string; event: 'text' | 'image' | 'other'; text: string | null; photoUrl: string | null }`
  - `parseZaloUpdate(body: unknown): ZaloUpdate | null` — zod over `body.result ?? body`; `null` if no `message.message_id`/`chat`/`from`, or `from.is_bot`. `event`: `message.text.received` → text, `message.image.received` → image (text = caption), else other. Unknown `chat_type` → `null`.
  - `ZALO_BOT_NAME = 'Sổ Chi'`, `ZALO_API_BASE`, `zaloApiUrl(method: string): string` → `${ZALO_API_BASE}/bot${env().ZALO_BOT_TOKEN}/${method}` (config.ts; see "One fixed bot").
  - `stripMention(text: string, botName: string = ZALO_BOT_NAME): string` — NFC both, remove every `@{botName}` case-insensitively (escape regex chars), collapse whitespace, trim.
  - `type Intent = { kind: 'link'; code: string } | { kind: 'undo' } | { kind: 'text'; text: string } | { kind: 'image'; url: string } | { kind: 'ignore' }`
  - `classify(update: ZaloUpdate): Intent` (uses `ZALO_BOT_NAME`) — image with url → image; other → ignore; text stripped: `/^\/link(?:\s+(\S+))?$/i` → link (code `''` if absent); `/^\/undo$/i` → undo; else text (possibly `''`).
  - `replies.ts` — every reply is an HTML string for `parse_mode: 'html'`. `escapeHtml(s: string): string` (`& < > " '`). Lines are separate `<p>…</p>` blocks (no `<br>` in Zalo's list). User-provided pieces (category names, store, note, user name) are cut to 120 chars, then escaped. Fixed copy (spec §8; the spec's backticks around examples become `<b>`):

```ts
export const REPLY = {
  noAmount: '<p>Mình chưa hiểu số tiền. Thử: <b>ăn phở 45k</b></p>',
  noTotal: '<p>Mình không đọc được tổng tiền, bạn gõ tay giúp nhé</p>',
  imageError: '<p>Ảnh lỗi, gửi lại giúp mình nhé</p>',
  error: '<p>Có lỗi, thử lại sau nhé</p>',
  nothingToUndo: '<p>Không có giao dịch nào để hoàn tác</p>',
  invalidCode:
    '<p>Mã không đúng hoặc đã hết hạn, tạo mã mới trong Cài đặt nhé</p>',
  linkInGroup: '<p>Nhắn riêng cho mình để liên kết nhé</p>',
  notLinked:
    '<p>Nhắn riêng cho mình để liên kết tài khoản trước nhé</p><p>Vào Sổ Chi › Cài đặt › Liên kết Zalo để lấy mã, rồi gửi: <b>/link MÃ</b></p>',
  qaSoon: '<p>Hỏi đáp sắp có</p>',
} as const;
```

- `confirmReply(tx: TxView, today: string, opts?: { note?: string | null }): string` → `<p>✓ {parent} › {child} · <b>{formatSignedVnd(amount, type)}</b> · {dateLabel(date, today, 'vi')}</p>` (root-only category → `✓ {name} · …`), then `<p><i>{note}</i></p>` when `opts.note`, then `<p>Gõ <b>/undo</b> để hủy</p>`.
- `undoneReply(tx: TxView): string` → `<p>↩ Đã hủy: {tx.note ?? tx.category.name} · <b>{formatSignedVnd}</b></p>`.
- `linkedReply(userName: string): string` → `<p>✓ Đã liên kết với Sổ Chi của <b>{userName}</b>.</p><p>Thử nhắn: <b>ăn phở 45k</b></p>`.
- `sendMessage(chatId: string, html: string): Promise<void>` — POST JSON `{ chat_id, text: html, parse_mode: 'html' }` to `zaloApiUrl('sendMessage')` (no slicing: replies are bounded by the 120-char field cut, so they stay far below 2000), `AbortSignal.timeout(10_000)`; on throw or `ok !== true` → `console.error` only (never throws, never logs the token).

- [ ] **Step 1: Write failing tests**

```ts
it('parses wrapped and bare bodies'); // the JSON from docs/zalo/bot.md and its `result` unwrapped → equal ZaloUpdate, chatId '456155d51d9af4c4a111', fromId '146155d51d9aa4c4dddd'
it('parses an image with caption'); // event 'image', photoUrl, text = caption
it('drops bot senders and malformed bodies');
it('strips the mention anywhere, case-insensitively'); // stripMention('ăn phở @sổ chi 45k') = 'ăn phở 45k'; stripMention('@Sổ Chi') = ''
it('classifies /link, /LINK abc123, /undo, text, image, sticker');
it('formats the confirm reply'); // food.breakfast 45000 today → '<p>✓ Ăn uống › Ăn sáng · <b>−45.000 ₫</b> · Hôm nay</p><p>Gõ <b>/undo</b> để hủy</p>'
it('formats income and root-only categories');
it('escapes user text in html replies'); // note '<b>x</b> & <script>' → contains '&lt;b&gt;x&lt;/b&gt; &amp; &lt;script&gt;', no raw '<script'
it('keeps a reply with 120-char fields under 2000 chars');
it('sendMessage posts parse_mode html to the fixed bot and swallows failures'); // URL = .../bot test-zalo-bot-token/sendMessage
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/server/zalo` → FAIL.
- [ ] **Step 3: Implement** the three files.
- [ ] **Step 4: Run to verify pass** — same → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(zalo): bot config, update parsing, html replies, send client"`

---

### Task 7: Update handler

**Files:**

- Create: `src/server/zalo/handler.ts`
- Test: `src/server/zalo/handler.test.ts`

**Interfaces:**

- Consumes: Tasks 2–6 (`redeemLinkCode`, `findUserIdByZaloId`, `undoLatestZaloTransaction`, `quickParseToInput`, `createTransaction`, `resolveCategorySlug`, `listCategories`, `downloadImage`, `putReceipt`, `deleteReceipt`, `aiCategoryOptions`, `parseText`, `parseReceipt`, `classify`, `REPLY`, `confirmReply`, `undoneReply`, `linkedReply`, `sendMessage`), `parseQuick`, `isQuestion`, `todayVn`, `txInputSchema`.
- Produces: `handleZaloUpdate(update: ZaloUpdate, now?: Date): Promise<void>` — never throws.

Flow (one reply per update, always to `update.chatId`; identity always `update.fromId`):

1. `intent = classify(update)`; `ignore` → return without replying.
2. `link`: GROUP → `linkInGroup`; PRIVATE → `redeemLinkCode({ code, zaloUserId: fromId, displayName: fromName })` → `linkedReply(userName)` or `invalidCode`.
3. `userId = findUserIdByZaloId(fromId)`; none → `notLinked`.
4. `undo` → `undoneReply(tx)` or `nothingToUndo`.
5. `text`: `''` → `noAmount`; `isQuestion` → `qaSoon`; `parseQuick(text, today)` null → `noAmount`; `input = quickParseToInput(userId, parsed)`; when `confidence === 'low'`, call `parseText` (catch → log, treat as `null`) and, if non-null, take `type`, `categoryId`, `store`, `note` from it — keep parseQuick's `amount` and `date` (deterministic, server-dated). `createTransaction(userId, input, 'zalo')` → `confirmReply`.
6. `image`: `downloadImage` fails → `imageError`; `key = putReceipt(...)`; `parseReceipt(...)`; `null`, `!isReceipt` or no `total` → `deleteReceipt(key)` + `noTotal`; category = `categoryId ?? resolveCategorySlug(userId, 'shop.goods', 'out')`, type from that category; validate with `txInputSchema` (invalid → `deleteReceipt` + `noTotal`); `createTransaction(userId, input, 'zalo', key)` → `confirmReply(tx, today, { note })`.
7. Any other thrown error → `console.error` + `error` reply. A failing `sendMessage` is already swallowed.

- [ ] **Step 1: Write failing tests** (`vi.mock` every consumed service/ai/zalo-client module; assert on `sendMessage` mock calls and on create args)

```ts
it('links by from.id and replies to chat.id'); // PRIVATE, chatId C, fromId F → redeem called with zaloUserId F; sendMessage(C, linkedReply)
it('refuses /link in a group'); // redeem not called; linkInGroup
it('replies invalidCode for a bad code');
it('asks unlinked users to link first'); // text from unknown fromId → notLinked, no create
it('undoes or reports nothing to undo');
it('creates a high-confidence text tx without calling Claude');
it(
  'uses Claude category/store/note for low confidence but keeps parsed amount and date',
);
it('falls back to the parsed category when Claude fails or refuses'); // parseText rejects → create still called with quick input
it('answers mention-only text with the syntax hint and questions with qaSoon');
it('creates a receipt tx with receiptKey and note line');
it('deletes the stored image when the photo is not a receipt');
it('replies imageError when download fails'); // putReceipt not called
it('replies the generic error when the DB throws');
it('ignores stickers silently');
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/server/zalo/handler.test.ts` → FAIL.
- [ ] **Step 3: Implement** `handler.ts`.
- [ ] **Step 4: Run to verify pass** — same → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(zalo): bot update handler"`

---

### Task 8: Webhook route, cleanup cron, setWebhook script

**Files:**

- Create: `src/app/api/zalo/webhook/route.ts`, `src/app/api/cron/cleanup/route.ts`, `scripts/zalo-set-webhook.ts`
- Test: `src/app/api/zalo/webhook/route.test.ts`, `src/app/api/cron/cleanup/route.test.ts`
- Modify: `package.json` (script `"zalo:webhook": "node --env-file=.env.local scripts/zalo-set-webhook.ts"`), `README.md` (bot setup section)

**Interfaces:**

- Consumes: `parseZaloUpdate`, `markUpdateSeen`, `handleZaloUpdate`, `pruneZaloData`.
- Produces:
  - `POST /api/zalo/webhook`: header `x-bot-api-secret-token` compared with `crypto.timingSafeEqual` (length check first) against `ZALO_WEBHOOK_SECRET` → mismatch `401`. Body JSON parse failure or `parseZaloUpdate` null → `200 { ok: true }` (no retry storm). `markUpdateSeen(messageId)` false → `200`. Else `after(() => handleZaloUpdate(update))` and `200 { ok: true }`. `export const maxDuration = 60` (receipt + Claude can take a while).
  - `GET /api/cron/cleanup`: `Authorization: Bearer ${CRON_SECRET}` (timing-safe) else `401`; `pruneZaloData()`; `200`.
  - `scripts/zalo-set-webhook.ts`: reads `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET`, `DEV_TUNNEL_HOST` (or `process.argv[2]` as full base URL), POSTs `setWebhook { url: <base>/api/zalo/webhook, secret_token }`, prints `result.verification` (never the token). Plain TS that Node 24 runs with type stripping (no imports from `src/`).

- [ ] **Step 1: Write failing tests** (`vi.mock('next/server', async (orig) => ({ ...(await orig()), after: vi.fn() }))`; mock `markUpdateSeen`, `handleZaloUpdate`, `pruneZaloData`)

```ts
it('rejects a wrong or missing secret with 401'); // after not called
it('acks malformed bodies with 200 and does nothing');
it('acks duplicates without scheduling work'); // markUpdateSeen → false
it('schedules the handler in after() for a new update'); // run the captured callback → handleZaloUpdate called with parsed update
it('cron cleanup requires the bearer secret');
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/app/api` → FAIL.
- [ ] **Step 3: Implement** both routes and the script; README: env keys, `pnpm tunnel` + `pnpm zalo:webhook`, `/link` flow, schedule `/api/cron/cleanup` daily (Vercel cron sends `Authorization: Bearer $CRON_SECRET`).
- [ ] **Step 4: Run to verify pass** — `pnpm vitest run src/app/api && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(zalo): webhook route, cleanup cron, setWebhook script"`

---

### Task 9: Settings "Liên kết Zalo" card + home Zalo card linked state

**Files:**

- Create: `src/features/settings/actions.ts`, `src/features/settings/zalo-link-card.tsx`
- Modify: `src/app/(main)/settings/page.tsx`, `src/app/(main)/page.tsx`, `src/features/home/stat-cards.tsx`, `src/features/home/zalo-card.tsx`, `messages/vi.json`, `messages/en.json`
- Test: `src/features/settings/countdown.test.ts` (pure helper)

**Interfaces:**

- Consumes: `createLinkCode`, `getZaloLink`, `unlinkZalo` (Task 2), `defineAction`.
- Produces:
  - `createLinkCodeAction(): Promise<ActionResult<{ code: string; expiresAt: string }>>` (`refresh: false`, ISO string); `unlinkZaloAction(): Promise<ActionResult<void>>` (refreshes). Built with `defineAction(z.object({}), …)`; wrappers call with `{}`.
  - `formatCountdown(msLeft: number): string` in `src/features/settings/countdown.ts` → `m:ss`, clamps at `0:00`.
  - `<ZaloLinkCard link={{ displayName: string } | null} />` (client).
  - `<ZaloCard linked={boolean} />` (server, reads `ZALO_BOT_NAME` from `src/server/zalo/config.ts` for `{bot}`); `StatCards` gains prop `zaloLinked: boolean`; home page loads `getZaloLink(user.id)` in its `Promise.all`.

UI (follow the existing settings card classes; HeroUI `Button`):

- Unlinked: title + body + primary "Tạo mã liên kết". After create: code in IBM Plex Mono 28px with letter-spacing, line `Nhắn riêng cho bot: /link ABC123` (command in mono), `Hết hạn sau 9:59` ticking each second; at 0 → "Mã đã hết hạn" + secondary "Tạo mã mới". While a code is showing, `router.refresh()` every 5 s so the card flips to linked when the bot redeems it (stop polling on unmount/expiry).
- Linked: `Đã liên kết với {name}` + secondary "Hủy liên kết" → `unlinkZaloAction`, toast `settings.zalo.unlinked`. Errors → toast `errors.<code>`.
- Home `ZaloCard`: unlinked unchanged; linked → title `home.zaloLinkedTitle`, body `home.zaloLinkedBody` with `{bot}`, no button.

Copy (vi / en):

| key                       | vi                                                                                 | en                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `settings.zalo.title`     | Liên kết Zalo                                                                      | Zalo link                                                                           |
| `settings.zalo.body`      | Tag bot trong nhóm Zalo hoặc nhắn riêng để ghi chi tiêu bằng chữ hoặc ảnh hóa đơn. | Tag the bot in a Zalo group or message it to log expenses by text or receipt photo. |
| `settings.zalo.create`    | Tạo mã liên kết                                                                    | Create link code                                                                    |
| `settings.zalo.hint`      | Nhắn riêng cho bot: {command}                                                      | Message the bot privately: {command}                                                |
| `settings.zalo.expiresIn` | Hết hạn sau {time}                                                                 | Expires in {time}                                                                   |
| `settings.zalo.expired`   | Mã đã hết hạn                                                                      | Code expired                                                                        |
| `settings.zalo.newCode`   | Tạo mã mới                                                                         | New code                                                                            |
| `settings.zalo.linkedAs`  | Đã liên kết với {name}                                                             | Linked as {name}                                                                    |
| `settings.zalo.unlink`    | Hủy liên kết                                                                       | Unlink                                                                              |
| `settings.zalo.unlinked`  | Đã hủy liên kết Zalo                                                               | Zalo unlinked                                                                       |
| `home.zaloLinkedTitle`    | Đã liên kết Zalo                                                                   | Zalo linked                                                                         |
| `home.zaloLinkedBody`     | Tag @{bot} trong nhóm hoặc nhắn riêng: “ăn phở 45k”, hay gửi ảnh hóa đơn.          | Tag @{bot} in a group or message it: “ăn phở 45k”, or send a receipt photo.         |

- [ ] **Step 1: Write failing test** — `formatCountdown(599_400) === '9:59'`, `(5_000) === '0:05'`, `(-1) === '0:00'`.
- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/features/settings` → FAIL.
- [ ] **Step 3: Implement** helper, actions, card, page wiring, copy.
- [ ] **Step 4: Verify** — `pnpm vitest run src/features/settings && pnpm typecheck && pnpm lint` → PASS; `pnpm dev`, open `/settings` and `/` in both locales, light/dark, ≥900px and <900px: create code → countdown runs; unlink works.
- [ ] **Step 5: Commit** — `git commit -m "feat(settings): zalo link card and linked home card"`

---

### Task 10: Receipts in the app + end-to-end bot check

**Files:**

- Modify: `src/features/transactions/tx-row.tsx`, `src/features/shell/tx-sheet-host.tsx`, `messages/vi.json`, `messages/en.json`

**Interfaces:**

- Consumes: `TxView.receiptKey`, `GET /api/receipts/[id]` (Task 4).

- Row: when `tx.receiptKey`, lucide `ReceiptText` 12px (`aria-label` = `t('…receipt')`) next to the Zalo icon. Indicator only — the row is already a button.
- Sheet (edit mode): keep `receiptTxId` state set from the loaded `TxView` (`v.receiptKey ? v.id : null`, cleared on new/close). Above the form render `<a href="/api/receipts/{id}" target="_blank" rel="noopener">` wrapping a 64×64 `rounded-[12px] object-cover` `<img src="/api/receipts/{id}" alt={t('…viewReceipt')}>` (plain `img`: the redirect target is a short-lived signed URL, `next/image` would cache it). Put both keys in the namespace the sheet already uses (`grep useTranslations src/features/shell/tx-sheet-host.tsx`): vi `receipt` "Hóa đơn", `viewReceipt` "Xem hóa đơn"; en "Receipt", "View receipt".

- [ ] **Step 1: Implement** row icon, sheet thumbnail, copy.
- [ ] **Step 2: Full verification** — `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all pass.
- [ ] **Step 3: Manual bot check** (`pnpm dev`, `pnpm tunnel`, `pnpm zalo:webhook`):
  - 1-1: `/link <code>` → linked reply; Settings flips to linked within ~5 s.
  - Group: `@Sổ Chi ăn phở 45k` → `✓ Ăn uống › Ăn sáng · −45.000 ₫ · Hôm nay` with the amount bold and lines split (if `<p>` renders with large gaps in Zalo, switch line joins to `\n` inside one `<p>` and update the reply tests); `@Sổ Chi /undo` → undone; `@Sổ Chi /link X` → linkInGroup.
  - Low-confidence text (`@Sổ Chi sửa xe 150k`) → sensible category from Claude.
  - Receipt photo → tx with note line; app list shows Zalo + receipt icons; sheet thumbnail opens the image.
  - Non-receipt photo → noTotal; resend same webhook (replay from ngrok inspector) → no duplicate tx.
  - Unlinked second Zalo account → notLinked.
- [ ] **Step 4: Commit** — `git commit -m "feat(transactions): receipt indicator and sheet thumbnail"`
