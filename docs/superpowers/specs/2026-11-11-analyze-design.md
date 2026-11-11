# Analyze (statistics page)

Date: 2026-11-11
Status: awaiting review

## Goal

Let a user see where their money went in a month or a year: totals, the split by category, and the trend over time, and jump from any number to the transactions behind it. The MVP spec listed "Thống kê" as out of scope; this is that spec.

A later spec (natural-language Q&A on web and Zalo) will reuse the aggregation services defined here as its tools, so they must be plain, `userId`-scoped functions with no UI concerns.

**Done when:**

- `/analyze` shows income, expense and net for the selected month or year, each compared with the previous period.
- A donut and ranked list show spending (or income) by parent category, expandable into child categories.
- A bar chart shows daily totals for a month and monthly totals for a year.
- Tapping a category opens `/transactions` filtered to that category and period.
- "Thống kê" is in the mobile tab bar; "Danh mục" is still reachable from Settings and the desktop sidebar.
- No AI calls.

## Decisions

| Topic           | Decision                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| Periods         | Tabs Month / Year; prev/next arrows; no custom range                     |
| Blocks          | Summary, category breakdown, trend                                       |
| Category levels | Donut by parent category; list rows expand into children                 |
| Donut slices    | Top 6 parents, the rest merged into "Khác" / "Other"                     |
| Type toggle     | Category block switches Chi / Thu (`type=out \| in`), default `out`      |
| Rendering       | Server Component page, state in URL, Recharts in small client components |
| Navigation      | "Thống kê" replaces "Danh mục" in the mobile tab bar                     |
| Charts library  | `recharts` (already a dependency)                                        |

Client-side fetching through server actions was rejected: it breaks the pattern every other page follows and loses back-button and shareable state.

## URL

`/analyze?view=month&p=2026-11&type=out`

`parseAnalyzeParams(searchParams, today)` in `src/features/analyze/search-params.ts`:

- `view`: `month | year`, default `month`.
- `p`: `YYYY-MM` for month, `YYYY` for year. Default is the current period (Vietnam time, `todayVn()`). A malformed value, a future period, or one more than 10 years before today falls back to the current period. A `p` that doesn't match `view` (e.g. `view=year&p=2026-08`) is converted: year takes the year of the month; month takes the current month if `p` is the current year, otherwise January of that year.
- `type`: `out | in`, default `out`. Only affects the category block.

Returns `{ view, period: {from, to}, prev: {from, to}, label, prevHref, nextHref | null }` so the page has no date math.

### Previous period

- Month view: the whole previous month. If the selected month is the current month, compare `[1st, today]` with the same day range of last month (reuse `sameRangeLastMonth` from `src/lib/dates.ts`), and `period.to` is today.
- Year view: the whole previous year. If the selected year is the current year, compare `[Jan 1, today]` with `[Jan 1, same day last year]`, and `period.to` is today. Feb 29 maps to Feb 28.

## Services

New file `src/server/services/analytics.ts`. Every function takes `userId` first, filters `transactions.userId = userId` and `deletedAt IS NULL`, and is added to `data-isolation.db.test.ts`. Dates are `YYYY-MM-DD` strings, matching `transactions.date`.

```ts
periodSummary(userId, range, prev): Promise<{
  income: number; expense: number;
  prevIncome: number; prevExpense: number;
}>
```

Four sums via the existing `sumRange` in `transactions.ts` (export it, or move it to a shared module). Net is computed in the UI.

```ts
categoryBreakdown(userId, type: TxType, range): Promise<Array<{
  id: string; name: string; icon: string; color: string;
  total: number;
  children: Array<{ id: string; name: string; total: number }>;
}>>
```

One query: join categories, `GROUP BY` the transaction's category, then fold rows into their parent in TypeScript (`parentId ?? id`). Transactions attached directly to a parent appear as a child row named after the parent ("chính nó" / "itself"), but only when the parent also has other children with spending in the range; otherwise `children` is empty. Parents and children are sorted by total descending. `transactions.categoryId` is `NOT NULL`, so there is no uncategorized bucket.

```ts
trend(userId, range, bucket: 'day' | 'month'): Promise<Array<{
  key: string;       // 'YYYY-MM-DD' or 'YYYY-MM'
  income: number; expense: number;
}>>
```

`GROUP BY date` or `to_char(date, 'YYYY-MM')` and `type`, then fill every bucket in the range with zeros in TypeScript. For the current month, buckets run to the end of the month (future days are zero) so the axis stays stable.

Pure helpers in `src/features/analyze/compute.ts` (unit tested): `topWithOther(rows, 6)`, `percentChange(current, prev)` (returns `null` when prev is 0), `fillBuckets`.

## Transactions page: period filter

`src/features/transactions/search-params.ts` gains two `period` values:

- `period=month&ym=YYYY-MM` → `monthRange` of that month.
- `period=year&y=YYYY` → Jan 1 to Dec 31.

Invalid `ym` / `y` fall back to `period=this`. `toTxFilter` maps both to `{from, to}`; the category filter already includes children of a parent.

The existing period control keeps its this / last / all options. When the URL has `month` or `year`, the filter bar shows a chip such as "Tháng 8/2026 ✕"; removing it returns to `period=this`. No month picker on the transactions page.

Links from `/analyze`: `/transactions?period=month&ym=2026-08&cat=<id>` (or `period=year&y=2025`).

## Page

`src/app/(main)/analyze/page.tsx`: `requireSession()`, parse params, call the three services in parallel, render. `loading.tsx` shows a skeleton. Errors fall through to the existing `(main)` error boundary.

Components in `src/features/analyze/`:

- `period-nav.tsx`: HeroUI Tabs for Month / Year and `‹ label ›` links. `›` is disabled at the current period. All links, no client state.
- `summary-cards.tsx`: Income, Expense, Net. Each shows the % change badge. For expense, up is red and down is green; for income, the reverse. `null` change shows "—".
- `category-breakdown.tsx` (client): Chi / Thu toggle (links that change `type`), Recharts donut of `topWithOther(…, 6)`, then the full ranked list: icon, name, amount, %, proportion bar. A row expands to its children; each child links to the filtered transactions page, and the parent row has a "Xem giao dịch" link. Slice colours come from the category's `color`; the "Khác" slice uses a neutral token.
- `trend-chart.tsx` (client): Recharts bar chart, expense bars with a fainter income bar beside them. X axis is day 1–31 or T1–T12. Tooltip uses the app's VND formatter. Today's bar (or the current month's) is highlighted.
- Charts read colours from CSS variables in `src/app/styles/tokens/` so dark mode works.
- Layout: one column on mobile; at the `wide` breakpoint, category and trend sit side by side under the summary.

Empty states:

- No transactions in the period: one block "Chưa có giao dịch trong tháng 8/2026" with an "Add transaction" button that calls `openNew()`.
- Category block with nothing of the selected type: "Chưa có khoản thu" / "Chưa có khoản chi".

Check the HeroUI v3 docs (Tabs, Card, Chip, Disclosure, Skeleton) before using each component.

## Navigation

- `src/features/shell/nav.ts`: add `{ href: '/analyze', labelKey: 'analyze', icon: ChartPie }`. Keep `NAV_ITEMS` (all five, used by the sidebar) and add `TAB_ITEMS` (home, transactions, analyze, settings) for the tab bar, replacing the index-based `slice` in `tab-bar.tsx`.
- `isNavActive` for the tab bar treats `/categories` as part of Settings.
- Settings page gets a "Danh mục" row linking to `/categories`.
- Home `stat-cards.tsx` gets a "Xem chi tiết →" link to `/analyze`.
- Every new string goes in both `messages/vi.json` and `messages/en.json`.

## Testing

Unit:

- `parseAnalyzeParams`: defaults, malformed `p`, future period, older than 10 years, `view`/`p` mismatch, prev-period computation (current month, past month, current year, Feb 29).
- `parseTxParams` / `toTxFilter`: `period=month` and `period=year`, invalid `ym` / `y`.
- `topWithOther`, `percentChange`, `fillBuckets`.

DB (`src/server/services/analytics.db.test.ts`):

- Sums match inserted data; soft-deleted rows excluded.
- Children fold into parents; a transaction on the parent itself appears as the "itself" child.
- Month and year boundaries (last day of month, Dec 31 / Jan 1).
- Trend buckets are complete and zero-filled.
- `data-isolation.db.test.ts`: a second user's transactions never appear in any of the three functions.

Charts are not unit tested; check them by running the app in light and dark mode on mobile and desktop widths.

## Out of scope

- Natural-language Q&A (separate spec, reuses these services).
- Custom date ranges, week view.
- Top stores, CSV export, budgets.
- AI-written insights.
