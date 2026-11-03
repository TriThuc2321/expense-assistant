# Sổ Chi Phase 2 — Personal Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record, edit, delete/undo, filter and search personal transactions through quick entry and the add/edit sheet, and manage categories.

**Architecture:** Pure helpers in `src/lib` (parser, formatting, dates, slug resolution) shared by client and server. Business logic in `src/server/services` (no `next/*` imports, `userId` first arg, always filtered by it). Server Components read via services; Server Actions are thin wrappers (`requireSession` → zod → service → `refresh()`) returning `ActionResult`. Client components live in `src/features/<screen>/`.

**Tech Stack:** Next.js 16.4 App Router, React 19.3, Drizzle + Postgres, HeroUI v3, next-intl, react-hook-form + zod 4, lucide-react, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-03-so-chi-mvp-design.md` (Phase 2 = §12; parser §6; UI §7). Design reference (not committed, local only): `docs/design_handoff_so_chi/README.md` and `design/So Chi.dc.html` — prototype logic is in the `<script data-dc-script>` block (lines ~796–1120).

## Global Constraints

- Before writing Next code read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and `09-revalidating.md`. After a mutation call `refresh()` from `next/cache` (all `(main)` pages are dynamic).
- Before using a HeroUI component read its docs via `node .agents/skills/heroui-react/scripts/get_component_docs.mjs <name>` (`.heroui-docs/` can't be generated).
- ALL data access in actions/pages goes through `requireSession()` from `src/server/auth/session.ts`, never `getAuth().api.getSession`.
- Every service function takes `userId: string` as first parameter and filters every query by it. Every read of `transactions` filters `deletedAt IS NULL` (except `restoreTransaction`).
- Server Action result type: `{ ok: true; data: T } | { ok: false; error: ActionErrorCode }`; client shows a toast with `t('errors.<code>')` on failure.
- Money: VND integer, always `<Money>` (IBM Plex Mono), expense prefix `−` (U+2212), income `+` + `text-success-text`. Same in both locales.
- "Today" is always computed in `Asia/Ho_Chi_Minh` on the server (`todayVn()`) and passed to clients as a `YYYY-MM-DD` string; clients never call `new Date()` for "today".
- All copy in `messages/vi.json` + `messages/en.json`; Vietnamese copy verbatim from the design. Category names are user data, never translated. Parser understands Vietnamese only.
- Icons: lucide-react, `strokeWidth={1.75}`.
- Toast API: `useToast().show({ title, onUndo? })`. App background class: `bg-app`.
- Keep add/edit form state outside `ResponsiveSheet` (it remounts children when crossing 900px).
- Comments only for non-obvious WHY (CLAUDE.md).
- Local DB: docker compose `expense-postgres` on port 5433; DB tests are `*.db.test.ts` and run with `pnpm test`.

## Review Focus

1. **Dotted thousands typed by Vietnamese users** — `cà phê 1.500.000` or `45.000` must parse as 1 500 000 / 45 000, not 1 500 / 45 000 by accident. Pinned in Task 2 (`parses dotted thousand separators`).
2. **Store title-casing with Vietnamese letters** — `trà sữa 55k ở phúc long` must yield store `Phúc Long`, not `PhúC Long` (the prototype's `\b\w` is ASCII-only). Pinned in Task 2.
3. **Deleting a subcategory whose transactions include soft-deleted ones** — the FK is `restrict`, so soft-deleted rows must also move to the parent or the delete fails. Pinned in Task 3.
4. **Month-boundary comparisons** — on Oct 31 the "same range last month" is Sep 1–30 (clamped), and "hôm qua" on Jan 1 is Dec 31 of the previous year. Pinned in Tasks 1 and 4.
5. **Cross-user access by id** — editing/deleting/restoring another user's transaction id, or saving with another user's categoryId, must fail as `not_found`, not succeed. Pinned in Task 4.

---

## File Structure

```
src/lib/
  format.ts (+test)         formatVnd (negatives), formatShortVnd, dateLabel
  dates.ts (+test)          todayVn, addDays, monthStart, monthRange, sameRangeLastMonth
  parse-quick.ts (+test)    parseQuick, isQuestion
  category-pick.ts (+test)  pickCategoryForSlug (pure fallback rule)
  action-result.ts          ActionResult, ActionErrorCode
src/server/
  services/errors.ts        ServiceError
  services/categories.ts    + listCategories, createCategory, deleteSubcategory, resolveCategorySlug
  services/transactions.ts  CRUD, list, summary
  action.ts (+test)         defineAction()
src/components/ui/category-tile.tsx   icon tile (name → lucide, color token)
src/features/
  tx-sheet/                 provider, form, host, actions
  home/                     quick entry, stat cards, zalo card, recent list
  transactions/             filters (URL), grouping, list, actions
  categories/               add form, cards, actions
  settings/                 profile, theme switch row, logout (existing)
```

---

### Task 1: Formatting and date helpers

**Files:**

- Modify: `src/lib/format.ts`, `src/lib/format.test.ts`
- Create: `src/lib/dates.ts`, `src/lib/dates.test.ts`

**Interfaces:**

- Produces (`dates.ts`, all strings are `YYYY-MM-DD`, pure UTC-calendar arithmetic, no local-TZ `Date` getters):
  - `todayVn(now?: Date): string` — calendar date in `Asia/Ho_Chi_Minh` (use `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`).
  - `addDays(date: string, n: number): string`
  - `monthStart(date: string): string`; `addMonths(monthStartDate: string, n: number): string` (input/outputs are first-of-month)
  - `monthRange(date: string): { from: string; to: string }` — first and last day of that month.
  - `sameRangeLastMonth(today: string): { from: string; to: string }` — day 1 to min(today's day, last day of previous month).
- Produces (`format.ts`):
  - `formatVnd(amount)` — negative amounts render with `−` U+2212.
  - `formatShortVnd(amount: number): string` — ≥1 000 000 → `(n/1e6)` vi-VN max 1 fraction digit + `tr`; else `Math.round(n/1000) + 'k'`.
  - `dateLabel(date: string, today: string, locale: Locale): string` — today → `Hôm nay`/`Today`; yesterday → `Hôm qua`/`Yesterday`; else vi `T2, 12/10` (weekday table `CN,T2..T7`), en `Mon, 12/10` (`Sun..Sat`), day/month without zero padding.

- [ ] **Step 1: Write failing tests**

```ts
// dates.test.ts
expect(todayVn(new Date('2026-10-13T17:30:00Z'))).toBe('2026-10-14'); // 00:30 in VN
expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
expect(monthRange('2026-02-10')).toEqual({
  from: '2026-02-01',
  to: '2026-02-28',
});
expect(sameRangeLastMonth('2026-10-14')).toEqual({
  from: '2026-09-01',
  to: '2026-09-14',
});
expect(sameRangeLastMonth('2026-10-31')).toEqual({
  from: '2026-09-01',
  to: '2026-09-30',
});
expect(sameRangeLastMonth('2026-03-31')).toEqual({
  from: '2026-02-01',
  to: '2026-02-28',
});

// format.test.ts (add)
expect(formatVnd(-5000)).toBe('−5.000 ₫');
expect(formatShortVnd(12_900_000)).toBe('12,9tr');
expect(formatShortVnd(25_000_000)).toBe('25tr');
expect(formatShortVnd(450_000)).toBe('450k');
expect(dateLabel('2026-10-14', '2026-10-14', 'vi')).toBe('Hôm nay');
expect(dateLabel('2026-10-13', '2026-10-14', 'en')).toBe('Yesterday');
expect(dateLabel('2026-10-12', '2026-10-14', 'vi')).toBe('T2, 12/10');
expect(dateLabel('2026-10-11', '2026-10-14', 'vi')).toBe('CN, 11/10');
expect(dateLabel('2026-10-12', '2026-10-14', 'en')).toBe('Mon, 12/10');
```

- [ ] **Step 2:** `pnpm test:unit src/lib` → FAIL (missing exports).
- [ ] **Step 3:** Implement. Weekday from `new Date(Date.UTC(y, m-1, d)).getUTCDay()`. Relative words are hard-coded per locale in `format.ts` (keeps it pure and testable; these are the only copy strings outside `messages/`).
- [ ] **Step 4:** `pnpm test:unit src/lib` → PASS.
- [ ] **Step 5:** Commit `feat(lib): date helpers, short money and date labels`.

---

### Task 2: Quick-entry parser

**Files:**

- Create: `src/lib/parse-quick.ts`, `src/lib/parse-quick.test.ts`

**Interfaces:**

- Consumes: `addDays` (Task 1), `DEFAULT_CATEGORIES` (`src/lib/categories-default.ts`), `TxType`.
- Produces:
  ```ts
  export type QuickParse = {
    type: TxType;
    amount: number;
    categorySlug: string;
    store: string | null;
    note: string;
    date: string;
    confidence: 'high' | 'low';
  };
  export function parseQuick(text: string, today: string): QuickParse | null;
  export function isQuestion(text: string): boolean;
  ```

Port `KW`, `STORES`, `parseQuick`, `isQuestion` from the prototype (lines 849–872) with these changes:

- `KW` entries map regex → slug (`'food.breakfast'`, …, or root slug `'food'` for root-only patterns). Root-only hit → first child of that root in `DEFAULT_CATEGORIES`. Keep the order and regexes verbatim; test against `low + ' '`.
- Amount: if the number token matches `^\d{1,3}(\.\d{3})+$`, strip dots (thousand separators) before applying unit/×1000 rules; otherwise comma/dot is a decimal separator. Units and `<1000 → ×1000` rule unchanged. `0` → `null`.
- `hôm qua` → `addDays(today, -1)`.
- Store from `ở|tại X`: title-case by splitting on whitespace and upper-casing each word's first character (Unicode-safe). Else `STORES` dictionary. Else `null`.
- Income override (`nhận|được cho|hoàn tiền`) → `income.other` unless the hit is already an income slug.
- `confidence = 'high'` iff a `KW` entry matched; fallback `shop.goods` is `'low'`.
- `note` = capitalized remainder, else the child's Vietnamese name from `DEFAULT_CATEGORIES`.

- [ ] **Step 1: Write failing tests** (today = `'2026-10-14'`), the spec §6 table plus Review Focus:

```ts
expect(parseQuick('ăn phở 45k', T)).toMatchObject({
  type: 'out',
  amount: 45000,
  categorySlug: 'food.breakfast',
  date: '2026-10-14',
  confidence: 'high',
});
expect(parseQuick('grab 32k hôm qua', T)).toMatchObject({
  type: 'out',
  amount: 32000,
  categorySlug: 'move.grab',
  store: 'Grab',
  date: '2026-10-13',
});
expect(parseQuick('trà sữa 55k ở Phúc Long', T)).toMatchObject({
  amount: 55000,
  categorySlug: 'food.coffee',
  store: 'Phúc Long',
});
expect(parseQuick('nhận lương 25tr', T)).toMatchObject({
  type: 'in',
  amount: 25_000_000,
  categorySlug: 'income.salary',
});
expect(parseQuick('1,5tr', T)).toMatchObject({
  amount: 1_500_000,
  categorySlug: 'shop.goods',
  confidence: 'low',
});
expect(isQuestion('Tháng này mình tiêu bao nhiêu cho cà phê?')).toBe(true);
// extra
expect(parseQuick('ăn uống 100k', T)?.categorySlug).toBe('food.breakfast'); // root-only → first child
expect(parseQuick('hoàn tiền shopee 200k', T)).toMatchObject({
  type: 'in',
  categorySlug: 'income.other',
});
expect(parseQuick('ăn phở', T)).toBeNull();
expect(parseQuick('ăn phở 0k', T)).toBeNull();
expect(isQuestion('ăn phở 45k')).toBe(false);
it('parses dotted thousand separators', () => {
  expect(parseQuick('cà phê 45.000', T)?.amount).toBe(45000);
  expect(parseQuick('tiền nhà 1.500.000', T)?.amount).toBe(1_500_000);
});
it('title-cases Vietnamese store names', () => {
  expect(parseQuick('trà sữa 55k ở phúc long', T)?.store).toBe('Phúc Long');
});
expect(parseQuick('grab 20k hôm qua', '2026-01-01')?.date).toBe('2025-12-31');
```

- [ ] **Step 2:** Run `pnpm test:unit src/lib/parse-quick.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(lib): port quick-entry parser`.

---

### Task 3: Category services

**Files:**

- Create: `src/lib/category-pick.ts`, `src/lib/category-pick.test.ts`, `src/server/services/errors.ts`
- Modify: `src/server/services/categories.ts`, `src/server/services/categories.db.test.ts`

**Interfaces:**

- Produces:
  ```ts
  // lib/category-pick.ts — pure, used by service and quick-entry preview
  export type PickableCategory = {
    id: string;
    slug: string | null;
    parentId: string | null;
    type: TxType;
    sortOrder: number;
  };
  export function pickCategoryForSlug(
    cats: PickableCategory[],
    slug: string,
  ): string | null;
  // slug → id; else 'shop.goods' → id; else first root with type 'out' by sortOrder; else null

  // services/errors.ts
  export type ServiceErrorCode =
    | 'not_found'
    | 'invalid_category'
    | 'duplicate_name';
  export class ServiceError extends Error {
    constructor(public code: ServiceErrorCode);
  }

  // services/categories.ts
  export type CategoryNode = Category & {
    children: (Category & { txCount: number })[];
    txCount: number;
  }; // txCount = live (non-deleted) tx in this node; a root's count includes its children
  export function listCategories(userId: string): Promise<CategoryNode[]>; // roots by sortOrder, children by sortOrder
  export function createCategory(
    userId: string,
    input: { name: string; parentId: string | null },
  ): Promise<Category>;
  export function deleteSubcategory(
    userId: string,
    id: string,
  ): Promise<{ moved: number }>;
  export function resolveCategorySlug(
    userId: string,
    slug: string,
  ): Promise<string>; // throws not_found if user has no out root
  ```
- `createCategory`: trims name; case-insensitive duplicate among siblings → `duplicate_name`. Child inherits parent's `icon`, `color`, `type`; `sortOrder` = max sibling + 1. Root: `icon 'tag'`, `type 'out'`, `color` = the `CategoryColor` (excluding `income`) at index `rootCount % 6`. `parentId` must be a root of this user (else `not_found`; a child as parent → `invalid_category`, max 2 levels).
- `deleteSubcategory`: in one DB transaction, move **all** transactions (including soft-deleted) from the child to its parent, then delete. A root id → `invalid_category` (deleting roots is out of scope). Other user's id → `not_found`.

- [ ] **Step 1: Write failing tests.** `category-pick.test.ts`: slug present → its id; slug missing → shop.goods id; both missing → first `out` root by sortOrder; no out roots → `null`. DB tests:

```ts
it('lists roots with children and live tx counts', …)            // soft-deleted tx not counted
it('creates a child inheriting icon/color/type and next sortOrder', …)
it('rejects a duplicate sibling name case-insensitively', …)      // 'cà phê' vs 'Cà phê' → duplicate_name
it('rejects a grandchild', …)                                     // invalid_category
it('moves live and soft-deleted transactions to the parent on delete', …)
it('refuses to delete a root', …)
it("cannot touch another user's category", …)                    // deleteSubcategory(u2, childOfU1) → not_found; createCategory(u2, { parentId: rootOfU1 }) → not_found
it('resolves slugs with fallback after the slug category was deleted', …)
```

Insert transactions directly with `getDb().insert(transactions)` in these tests (Task 4 services don't exist yet).

- [ ] **Step 2:** `pnpm test` → new tests FAIL.
- [ ] **Step 3:** Implement. `resolveCategorySlug` loads the user's categories and calls `pickCategoryForSlug`.
- [ ] **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5:** Commit `feat(categories): list, create, delete subcategory, slug resolution`.

---

### Task 4: Transaction services

**Files:**

- Create: `src/server/services/transactions.ts`, `src/server/services/transactions.db.test.ts`

**Interfaces:**

- Consumes: `ServiceError`, `resolveCategorySlug` (Task 3), `monthRange`, `sameRangeLastMonth` (Task 1).
- Produces:
  ```ts
  export type TxInput = { type: TxType; amount: number; categoryId: string; store: string | null; note: string | null; date: string };
  export type TxView = {
    id: string; type: TxType; amount: number; date: string; store: string | null; note: string | null;
    source: 'app' | 'zalo'; receiptKey: string | null; createdAt: Date;
    category: { id: string; name: string; parentName: string | null; icon: string; color: string };
  };
  export type TxFilter = { from?: string; to?: string; categoryId?: string; min?: number; max?: number; store?: string };

  createTransaction(userId, input: TxInput, source: 'app' | 'zalo' = 'app'): Promise<TxView>
  updateTransaction(userId, id: string, input: TxInput): Promise<TxView>
  softDeleteTransaction(userId, id: string): Promise<void>
  restoreTransaction(userId, id: string): Promise<void>
  getTransaction(userId, id: string): Promise<TxView>             // not_found if missing/deleted/other user
  listTransactions(userId, filter: TxFilter): Promise<TxView[]>   // date desc, createdAt desc
  hasTransactionsBefore(userId, date: string, filter: Omit<TxFilter, 'from' | 'to'>): Promise<boolean>
  recentTransactions(userId, limit: number): Promise<TxView[]>
  monthSummary(userId, today: string): Promise<{ spent: number; spentLastSameRange: number; income: number }>
  ```
- Validation in service: `categoryId` must belong to the user (else `not_found`) and `category.type === input.type` (else `invalid_category`). `amount` positive integer is enforced by zod in actions and the DB check.
- `TxFilter.categoryId` matching a root includes its children. `store` is case-insensitive substring (`ilike` with `%` and `_` escaped). `min`/`max` inclusive.
- `TxView.category.icon/color` come from the category row; `parentName` from a self-join (drizzle `alias`).
- `monthSummary`: `spent` = out sum from `monthRange(today).from` to `today`; `spentLastSameRange` = out sum over `sameRangeLastMonth(today)`; `income` = in sum over the whole current month. Sum in SQL, cast to number.

- [ ] **Step 1: Write failing DB tests:**

```ts
it('creates, reads and lists only the owner's transactions', …)
it('rejects a category of another user or of the wrong type', …)   // not_found / invalid_category
it('soft-deletes and restores', …)                                  // list excludes after delete, includes after restore
it("cannot update, delete or restore another user's transaction", …) // all → not_found
it('filters by root category including children, amount range, store substring', …) // store '50%' doesn't wildcard
it('summarises month-to-date vs same range last month', …)         // today '2026-10-31': Sep 30 counted, Oct 1 of next month not
it('reports whether older transactions exist', …)
```

- [ ] **Step 2:** `pnpm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5:** Commit `feat(transactions): transaction services`.

---

### Task 5: Server action wrapper and shared UI bits

**Files:**

- Create: `src/lib/action-result.ts`, `src/server/action.ts`, `src/server/action.test.ts`, `src/components/ui/category-tile.tsx`
- Modify: `messages/vi.json`, `messages/en.json` (add `errors.*`)

**Interfaces:**

- Produces:
  ```ts
  // lib/action-result.ts
  export type ActionErrorCode = ServiceErrorCode | 'invalid_input' | 'unknown';
  export type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: ActionErrorCode };

  // server/action.ts
  export function defineAction<S extends z.ZodType, T>(
    schema: S,
    handler: (userId: string, input: z.infer<S>) => Promise<T>,
  ): (input: z.input<S>) => Promise<ActionResult<T>>;
  ```
  Order: `requireSession()` (its redirect must propagate — don't catch it; rethrow anything for which `unstable_rethrow` from `next/navigation` applies), `schema.safeParse` → `invalid_input`, run handler, `refresh()` from `next/cache` on success, `ServiceError` → its code, anything else → `console.error` + `unknown`.
  Each feature's `actions.ts` starts with `'use server'` and exports `const x = defineAction(...)`. If Next rejects non-async exports in `'use server'` files, export `async function x(input) { return inner(input); }` instead.
- `<CategoryTile icon: string; color: string; size?: 38 | 44 />` — 38×38, radius 14, background `color-mix(in oklab, var(--cat-<color>) 14%, transparent)`, icon colored `var(--cat-<color>)`, size 20. Static map `{ utensils, house, bike, 'shopping-bag', clapperboard, 'heart-pulse', wallet, tag }` → lucide components; unknown → `Tag`.
- Messages: `errors.not_found` "Không tìm thấy dữ liệu" / "Not found"; `errors.invalid_category` "Danh mục không hợp lệ" / "Invalid category"; `errors.duplicate_name` "Tên này đã có" / "That name already exists"; `errors.invalid_input` "Dữ liệu chưa hợp lệ" / "Invalid input"; `errors.unknown` "Có lỗi, thử lại sau nhé" / "Something went wrong, please try again".

- [ ] **Step 1: Write failing tests** (`vi.mock('@/server/auth/session')`, `vi.mock('next/cache')`): returns `invalid_input` for bad input without calling the handler; maps `ServiceError('not_found')`; maps a thrown `Error` to `unknown`; passes `session.user.id` to the handler and calls `refresh` once on success; does not call `refresh` on failure.
- [ ] **Step 2:** `pnpm test:unit src/server/action.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS; `pnpm typecheck` passes.
- [ ] **Step 5:** Commit `feat: server action wrapper, category tile, error copy`.

---

### Task 6: Add/Edit transaction sheet

**Files:**

- Create: `src/features/tx-sheet/actions.ts`, `src/features/tx-sheet/tx-sheet-provider.tsx`, `src/features/tx-sheet/tx-form.tsx`, `src/features/tx-sheet/schema.ts`, `src/features/tx-sheet/schema.test.ts`
- Modify: `src/features/shell/tx-sheet-host.tsx` (rewrite; remove "Thử toast" button and "Phase 2" caption), `src/app/(main)/layout.tsx`, `src/features/shell/sidebar.tsx`, `src/features/shell/tab-bar.tsx`, messages.

**Interfaces:**

- Consumes: `defineAction` (Task 5), transaction services (Task 4), `listCategories` (Task 3), `todayVn` (Task 1), `CategoryTile`.
- Produces:
  ```ts
  // features/tx-sheet/schema.ts
  export const txInputSchema: z.ZodType<TxInput>; // amount int 1..1e12, date /^\d{4}-\d{2}-\d{2}$/, store/note trimmed, '' → null, max 200 chars
  export function parseAmountText(text: string): number;  // digits only → number ('45.000' → 45000, '' → 0)
  export function formatAmountText(n: number): string;    // 45000 → '45.000', 0 → ''

  // features/tx-sheet/actions.ts
  createTxAction(input: TxInput): Promise<ActionResult<TxView>>
  createQuickTxAction(input: { type; amount; categorySlug: string; store; note; date }): Promise<ActionResult<TxView>> // resolves slug server-side
  updateTxAction(input: { id: string } & TxInput)
  deleteTxAction({ id }): Promise<ActionResult<void>>
  restoreTxAction({ id }): Promise<ActionResult<void>>
  getTxAction({ id }): Promise<ActionResult<TxView>>

  // features/tx-sheet/tx-sheet-provider.tsx (client)
  export type TxDraft = Partial<TxInput>;
  export function TxSheetProvider(props: { categories: CategoryNode[]; today: string; children: ReactNode }): JSX.Element;
  export function useTxSheet(): { openNew(draft?: TxDraft): void; openEdit(id: string): void; categories: CategoryNode[]; today: string };
  ```
- Provider holds `draft` in state and drives the URL (`?tx=new` / `?tx=<id>`) using the existing `withQuery` logic; `useOpenNewTx` is replaced by `useTxSheet().openNew` in Sidebar and TabBar. Layout renders `<TxSheetProvider categories={await listCategories(user.id)} today={todayVn()}>` around children + host.
- Host owns the react-hook-form `useForm` (form state outside `ResponsiveSheet`). On open: `new` → reset to `{ type: 'out', amount: 0, categoryId: first child of first out root, store: null, note: null, date: today, ...draft }`; `<id>` → call `getTxAction`, show a spinner until loaded, `not_found` → toast + close. Title is captured when opening so it doesn't flip during the close animation.
- Form (`tx-form.tsx`, receives `control`): pill Tabs "Khoản chi"/"Khoản thu" (switching type resets category to first child of first root of that type); "Số tiền" large input with `₫` suffix, formats as you type via `formatAmountText(parseAmountText(v))`, `inputMode="numeric"`; category grid (roots of the current type, cells min 88px, `CategoryTile` + caption, selected = `bg-surface-selected` + accent border) → selecting a root selects its first child (or the root itself if it has none); child Tags row; "Ghi chú", "Cửa hàng", "Ngày" (`type="date"`). No "Lặp lại hàng tháng".
- Footer: editing → left "Xóa" (danger); right "Hủy", primary "Thêm"/"Lưu" (disabled when amount is 0 or pending).
- Toasts: add → `tx.added` with undo → `deleteTxAction`; save → `tx.saved` (no undo); delete → `tx.deleted` with undo → `restoreTxAction`. On error → `t('errors.' + code)`.
- Messages (vi / en): `tx.expense` "Khoản chi"/"Expense", `tx.income` "Khoản thu"/"Income", `tx.amount` "Số tiền"/"Amount", `tx.category` "Danh mục"/"Category", `tx.note` "Ghi chú"/"Note", `tx.store` "Cửa hàng"/"Store", `tx.date` "Ngày"/"Date", `tx.add` "Thêm"/"Add", `tx.save` "Lưu"/"Save", `tx.delete` "Xóa"/"Delete", `tx.saved` "Đã lưu thay đổi"/"Changes saved", `tx.deleted` "Đã xóa giao dịch"/"Transaction deleted".

- [ ] **Step 1: Write failing tests** `schema.test.ts`: `parseAmountText('45.000') === 45000`; `parseAmountText('abc') === 0`; `formatAmountText(1500000) === '1.500.000'`; `txInputSchema` rejects amount 0, non-integer, date `'14/10/2026'`, and maps `store: '  '` → `null`.
- [ ] **Step 2:** `pnpm test:unit src/features/tx-sheet` → FAIL.
- [ ] **Step 3:** Implement schema, actions, provider, host, form. Read HeroUI docs for `tabs`, `tag-group`, `input-group`, `text-field`, `button`.
- [ ] **Step 4:** Tests PASS; `pnpm typecheck` and `pnpm lint` pass. Manually (`pnpm dev`): add via sidebar and tab-bar "+", undo removes it; open `/?tx=<id>`, edit, save; delete then undo; `/?tx=<random-uuid>` shows the not-found toast; resize across 900px while the sheet is open — typed values survive.
- [ ] **Step 5:** Commit `feat(tx-sheet): add, edit, delete and undo transactions`.

---

### Task 7: Tổng quan (Home)

**Files:**

- Create: `src/features/home/quick-entry.tsx`, `src/features/home/stat-cards.tsx`, `src/features/home/zalo-card.tsx`, `src/features/transactions/tx-row.tsx`
- Modify: `src/app/(main)/page.tsx`, messages.

**Interfaces:**

- Consumes: `parseQuick`, `isQuestion` (Task 2), `pickCategoryForSlug` (Task 3), `monthSummary`, `recentTransactions` (Task 4), `createQuickTxAction`, `useTxSheet` (Task 6), `dateLabel`, `CategoryTile`, `Money`.
- Produces: `<TxRow tx: TxView; today: string />` (client; tile 38, title = `note ?? category.name`, meta `"{parent} › {child} · {store}"` (parent omitted for roots), right `<Money>` 13/500 + `dateLabel`, `source === 'zalo'` shows lucide `MessageCircle` 12px before the meta; click → `openEdit(tx.id)`). Reused by Task 8.
- Quick entry panel (radius 24, padding 20): overline with `Sparkles` "Nhập nhanh hoặc hỏi"; lg input with `Zap` icon, placeholder "ăn phở 45k · tháng này tiêu bao nhiêu cho cà phê?"; no mic; button "Lưu" (disabled when empty, unparseable, or a question). Question → caption `home.askSoon` "Hỏi đáp sắp có" / "Q&A is coming soon". Parsed → preview row (inset bg, radius 20): tile of the picked category, title `note`, badge "Khoản chi" (accent) / "Khoản thu" (success), meta `"{root} › {child} · {store} · {dateLabel}"`, mono amount, ghost "Chỉnh" → `openNew({ type, amount, categoryId: picked, store, note, date })`. Enter submits. Save → `createQuickTxAction`, clear input, toast `tx.added` with undo. Example tags (verbatim): "ăn phở 45k", "grab 32k hôm qua", "trà sữa 55k ở Phúc Long", "nhận lương 25tr", "Tháng này mình tiêu bao nhiêu cho cà phê?" — click fills the input.
- Stat cards (grid auto-fit min 220): (1) `home.spent` "Đã chi {month}" where `month` = `format.dateTime(today, { month: 'long' })` (vi → "tháng 10"; en "Spent in {month}") + mono 25px + delta Badge `↑ n%` danger / `↓ n%` success with caption `home.vsRange` "so với {range}" / "vs {range}", `range` = `1–{toDay}/{prevMonth}`; no badge when `spentLastSameRange` is 0. (2) `home.income` "Thu nhập" (success text) + `home.remaining` "Còn lại {amount}" / "Left {amount}" (negative shown via `formatVnd` with `−`, `text-danger-text`). (3) `ZaloCard` in its unlinked state: title `home.zaloTitle` "Ghi chi tiêu qua Zalo" / "Log expenses via Zalo", body `home.zaloBody` "Liên kết Zalo để tag bot ghi chi tiêu bằng chữ hoặc ảnh hóa đơn." / "Link Zalo to log expenses by tagging the bot with text or a receipt photo.", link button `home.zaloLink` "Liên kết Zalo" / "Link Zalo" → `/settings`.
- Recent list "Gần đây" / "Recent" (6 rows, full width) with ghost "Xem tất cả" / "See all" → `/transactions`; empty → `home.recentEmpty` "Chưa có giao dịch nào" / "No transactions yet".

- [ ] **Step 1:** Implement. Page reads `todayVn()`, `monthSummary`, `recentTransactions(user.id, 6)`, categories (flattened to `PickableCategory[]` for the preview) in parallel with `Promise.all`.
- [ ] **Step 2:** `pnpm typecheck`, `pnpm lint` pass. Manually: each example tag shows the expected preview (phở → Ăn uống › Ăn sáng; Phúc Long store; lương → Khoản thu); the question tag disables Lưu with "Hỏi đáp sắp có"; saving updates stat cards and Gần đây without reload; "Chỉnh" opens the sheet prefilled; compare with prototype light/dark, ≥900px and <900px.
- [ ] **Step 3:** Commit `feat(home): quick entry, stat cards, recent transactions`.

---

### Task 8: Giao dịch (Transactions)

**Files:**

- Create: `src/features/transactions/search-params.ts`, `src/features/transactions/search-params.test.ts`, `src/features/transactions/group.ts`, `src/features/transactions/group.test.ts`, `src/features/transactions/transactions-view.tsx`
- Modify: `src/app/(main)/transactions/page.tsx`, messages.

**Interfaces:**

- Consumes: `listTransactions`, `hasTransactionsBefore` (Task 4), `monthRange`, `monthStart`, `addMonths` (Task 1), `TxRow` (Task 7), `useTxSheet`.
- Produces:
  ```ts
  // search-params.ts
  export type TxPageParams = {
    period: 'this' | 'last' | 'all';
    cat?: string;
    min?: number;
    max?: number;
    store?: string;
    months: number;
  };
  export function parseTxParams(
    sp: Record<string, string | string[] | undefined>,
  ): TxPageParams; // invalid values dropped, months clamped 1..120, default period 'this', months 1
  export function toTxFilter(p: TxPageParams, today: string): TxFilter; // this → monthRange(today); last → previous month; all → from addMonths(monthStart(today), -(months-1)), no `to`
  // group.ts
  export function matchesSearch(tx: TxView, q: string): boolean; // case-insensitive over note, store, category.name, parentName
  export function groupByDate(
    txs: TxView[],
  ): { date: string; items: TxView[]; outTotal: number }[]; // keeps input order
  ```
- Page (server): `await props.searchParams` → `parseTxParams` → `listTransactions`; for `all`, `hasMore = hasTransactionsBefore(...)`. Overline `transactions.summary` "{count} giao dịch · chi {sum}" / "{count} transactions · spent {sum}" over the **search-filtered** client list; h2; secondary "Thêm" → `openNew()`.
- Client view: search input (client-only filter), filter icon button (`SlidersHorizontal`) toggling the advanced panel: "Số tiền từ" / "Đến" / "Cửa hàng" / "Xóa bộ lọc" — applied to the URL on blur/Enter with `router.replace(..., { scroll: false })`; period Tags "Tháng này" / "Tháng trước" / "Tất cả" | divider | root category Tags (toggle). Date-group cards: inset header with `dateLabel` + mono day out total (`−…`, hidden when 0). "Xem thêm" / "Load more" (period `all` and `hasMore`) → `months + 1`. Empty: "Không có giao dịch khớp bộ lọc. Thử bỏ bớt điều kiện." / "No transactions match the filters. Try removing some."
- English for tags/fields: "This month", "Last month", "All", "Amount from", "To", "Store", "Clear filters", "Search", "Add".

- [ ] **Step 1: Write failing tests**: `parseTxParams({ period: 'x', min: 'abc', months: '999' })` → `{ period: 'this', months: 120 }` with no `min`; `toTxFilter({ period: 'last', months: 1 }, '2026-01-15')` → `{ from: '2025-12-01', to: '2025-12-31' }`; `toTxFilter({ period: 'all', months: 3 }, '2026-10-14').from === '2026-08-01'`; `groupByDate` sums only `out` per day; `matchesSearch` matches parent name and is case-insensitive (`'PHÚC'` matches store `Phúc Long`).
- [ ] **Step 2:** `pnpm test:unit src/features/transactions` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests PASS; typecheck/lint pass. Manually: each filter changes the URL and survives reload; search narrows the loaded list and the overline; "Tất cả" + "Xem thêm" loads older months; row click opens edit; compare with prototype at both breakpoints/themes.
- [ ] **Step 5:** Commit `feat(transactions): list with filters, search and grouping`.

---

### Task 9: Danh mục (Categories)

**Files:**

- Create: `src/features/categories/actions.ts`, `src/features/categories/add-category-card.tsx`, `src/features/categories/category-card.tsx`
- Modify: `src/app/(main)/categories/page.tsx`, messages.

**Interfaces:**

- Consumes: `listCategories`, `createCategory`, `deleteSubcategory` (Task 3), `defineAction` (Task 5), `CategoryTile`.
- Produces: `createCategoryAction({ name: string (1..40 trimmed); parentId: string | null })`; `deleteSubcategoryAction({ id })` → `ActionResult<{ moved: number }>`.
- "Thêm danh mục" card: parent Tags ("Danh mục gốc" + each root), input with placeholder "Mục con của {parent}" / "Tên danh mục mới" ("Subcategory of {parent}" / "New category name"), button "Thêm". Success → clear input, toast `categories.added` "Đã thêm danh mục" / "Category added".
- Category cards: tile, name, Badge "Chi"/"Thu" ("Expense"/"Income"), child Tags with remove ×. Remove: the child's `txCount` (from `listCategories`) is 0 → delete directly; > 0 → HeroUI AlertDialog: title "Xóa {name}?" / "Delete {name}?", body "{count} giao dịch sẽ được chuyển sang {parent}." / "{count} transactions will move to {parent}.", buttons "Hủy" / "Xóa". Toast `categories.deleted` "Đã xóa danh mục" / "Category deleted". No root deletion, no icon/color editing.

- [ ] **Step 1:** Implement (read HeroUI `alert-dialog`, `tag-group`, `badge` docs).
- [ ] **Step 2:** Typecheck/lint pass. Manually: add root, add child under it, duplicate name shows "Tên này đã có"; delete empty child; delete child with transactions → confirm → those transactions show under the parent on /transactions; new child appears in the sheet's category picker without reload.
- [ ] **Step 3:** Commit `feat(categories): manage categories`.

---

### Task 10: Cài đặt (Settings) and Phase 1 carry-over polish

**Files:**

- Create: `src/features/settings/theme-switch-row.tsx`
- Modify: `src/app/(main)/settings/page.tsx`, `src/features/settings/logout-button.tsx`, `src/features/shell/sidebar.tsx`, `src/features/shell/tab-bar.tsx`, messages.

**Interfaces:**

- Consumes: `requireSession`, `listCategories`, `UserAvatar`, `next-themes` `useTheme`.
- Settings page (max-w 640): profile card (lg avatar, name, `"{email} · Google"`); list card with link row "Danh mục" + count of roots + `ChevronRight` → `/categories`; card with "Giao diện tối" / "Dark mode" HeroUI Switch bound to `resolvedTheme === 'dark'` (render after mount to avoid hydration mismatch); secondary full-width "Đăng xuất". No Zalo card (Phase 3), no recurring/PWA rows.
- Logout: if `authClient.signOut()` returns `{ error }`, show toast `errors.unknown` and stay; otherwise `router.replace('/login')`.
- Nav landmarks: `aria-label={t('nav.main')}` on sidebar `<nav>` and tab bar `<nav>`; `nav.main` "Điều hướng chính" / "Main navigation".

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Typecheck/lint pass. Manually: switch toggles theme and persists after reload; categories count matches; logout works; nav landmarks have names (inspect accessibility tree).
- [ ] **Step 3:** Commit `feat(settings): profile, theme switch, polish carry-overs`.

---

### Task 11: Phase exit check

- [ ] **Step 1:** `docker compose up -d` then `pnpm test` → all unit + db tests pass.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm build` → all succeed.
- [ ] **Step 3:** Grep: `rg "getAuth\(\)\.api\.getSession" src/features src/app` → no hits; `rg "Thử toast|Phase 2" src` → no hits; every `messages/vi.json` key exists in `en.json` (`node -e` key-diff script) → no diff.
- [ ] **Step 4:** Manual walkthrough against spec §12 "Xong khi": quick-entry add, sheet add/edit/delete/undo, filters + search, category add/delete — in vi and en, light and dark, ≥900px and <900px.
- [ ] **Step 5:** Update `README.md` Phase status; commit `docs: phase 2 status`.
