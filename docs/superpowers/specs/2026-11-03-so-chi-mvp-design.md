# Sổ Chi — MVP cá nhân + Zalo bot

- Ngày: 2026-11-03
- Trạng thái: chờ duyệt
- Nguồn design: `docs/design_handoff_so_chi/` (README là spec UI chi tiết, `design/So Chi.dc.html` là prototype). Thư mục này không commit; spec này chỉ ghi các quyết định và phần **khác** với handoff.

## 1. Mục tiêu

App dùng thật cho chủ dự án và vài người quen. Ưu tiên chạy được sớm, phạm vi gọn.

MVP thành công khi:

1. Đăng nhập Google (chỉ email trong allowlist), dùng app hằng ngày để ghi, xem, sửa, xóa chi tiêu.
2. Gõ "ăn phở 45k" trên app → thấy preview ngay → lưu được.
3. Tag bot trong nhóm Zalo (hoặc nhắn riêng) bằng chữ hoặc ảnh hóa đơn → giao dịch vào sổ cá nhân của người tag, bot trả lời xác nhận, `/undo` được.

## 2. Phạm vi

**Trong MVP:** login, Tổng quan, Giao dịch, sheet Thêm/Sửa, Danh mục, Cài đặt (gồm liên kết Zalo), Zalo bot (chữ + ảnh hóa đơn), song ngữ vi/en.

**Ngoài MVP (spec riêng sau):** Thống kê, Hỏi đáp, Giao dịch định kỳ, Chia tiền nhóm (kể cả nối group Zalo ↔ nhóm chia tiền), PWA/offline, nhập bằng giọng nói, bot trả lời song ngữ.

## 3. Quyết định đã chốt

| Chủ đề        | Quyết định                                                                                      | Khác handoff                 |
| ------------- | ----------------------------------------------------------------------------------------------- | ---------------------------- |
| Stack         | Giữ Next.js 16 App Router + Postgres/Drizzle + better-auth                                      | Handoff đề xuất Vite + Dexie |
| Dữ liệu       | Online là chính; không offline-first                                                            | Handoff: offline-first       |
| Kiến trúc     | Server Components đọc dữ liệu, Server Actions để ghi; nghiệp vụ ở `server/services` thuần       | —                            |
| UI            | HeroUI v3 theme lại bằng token TH; tinh chỉnh bằng `className` khi cần                          | Handoff: tự viết primitives  |
| Icon          | `lucide-react`, strokeWidth 1.75 (logo Google giữ `react-icons`)                                | —                            |
| Ngôn ngữ      | next-intl song ngữ vi/en; vi chép nguyên văn design; nút đổi ngôn ngữ giữ ở header như hiện tại | Handoff: chỉ tiếng Việt      |
| Truy cập      | Allowlist email qua env `ALLOWED_EMAILS`                                                        | —                            |
| Parser app    | Port `parseQuick` rule-based, chạy trên client                                                  | —                            |
| Giọng nói     | Không làm                                                                                       | Handoff có                   |
| Bot           | Zalo group (khi được tag) + chat 1-1; ghi vào sổ cá nhân người tag                              | Không có trong handoff       |
| Liên kết Zalo | Mã 6 ký tự tạo trong app, `/link CODE` chỉ nhận qua chat 1-1                                    | —                            |
| Bot ghi       | Ghi luôn, trả lời xác nhận, `/undo` trong 10 phút                                               | —                            |
| Claude        | `claude-opus-5-5`, effort `low`, structured outputs, `fallbacks: "default"`                     | —                            |
| Ảnh hóa đơn   | Tải về → lưu R2 → gửi Claude dạng base64; một hóa đơn = một giao dịch tổng                      | —                            |
| Tiền          | Luôn VND, luôn hiển thị "45.000 ₫" (IBM Plex Mono) ở cả hai ngôn ngữ                            | —                            |
| Múi giờ       | Mọi "hôm nay/hôm qua" tính theo `Asia/Ho_Chi_Minh`                                              | —                            |

## 4. Kiến trúc

```
src/
  lib/                    # thuần, chạy được client + server, có unit test
    parse-quick.ts        # parseQuick + isQuestion
    format.ts             # tiền, dạng rút gọn, nhãn ngày theo locale
    categories-default.ts # bộ danh mục seed + slug (dùng chung cho seed và parser)
  server/
    db/                   # Drizzle schema, client, migrations
    auth.ts               # better-auth + Google + allowlist + seed danh mục lần đầu
    services/             # nghiệp vụ, không import gì từ next/*
      transactions.ts  categories.ts  zalo-link.ts  receipts.ts
    ai/                   # parseText(), parseReceipt()
    zalo/                 # client gửi tin + handler từng loại tin
  app/
    (auth)/login/
    (main)/               # layout = app shell
      page.tsx            # Tổng quan
      transactions/  categories/  settings/
    api/auth/[...all]/route.ts
    api/zalo/webhook/route.ts
  features/<màn hình>/    # component + server action riêng của từng màn hình
```

Quy tắc:

- Server Action và webhook là lớp vỏ mỏng: xác thực → validate zod → gọi `services/*`.
- Mọi hàm service nhận `userId` làm tham số đầu và luôn lọc theo nó.
- Server Action trả `{ ok: true, data } | { ok: false, error }`; client hiện toast lỗi.
- Trước khi code, đọc docs Next 16 trong `node_modules/next/dist/docs/` (server actions, caching/revalidate, `after()`, proxy/middleware) và docs HeroUI v3 (`heroui agents-md --react` nếu thiếu `.heroui-docs`).

## 5. Mô hình dữ liệu

Bảng của better-auth: `user`, `session`, `account`, `verification`.

**`categories`**

| Cột       | Kiểu                | Ghi chú                                                                          |
| --------- | ------------------- | -------------------------------------------------------------------------------- |
| id        | uuid pk             |                                                                                  |
| userId    | fk user             |                                                                                  |
| parentId  | fk categories, null | null = danh mục gốc; tối đa 2 cấp                                                |
| slug      | text, null          | chỉ danh mục seed có, ví dụ `food`, `food.breakfast`; unique theo (userId, slug) |
| name      | text                |                                                                                  |
| icon      | text                | tên icon lucide (danh mục con kế thừa của cha khi hiển thị)                      |
| color     | text                | token màu category (`food`, `home`…)                                             |
| type      | `'out' \| 'in'`     |                                                                                  |
| sortOrder | int                 |                                                                                  |

Seed khi user đăng nhập lần đầu, tên theo ngôn ngữ đang dùng lúc đó, lấy từ `CATS0` của prototype:

| Gốc (slug)                    | Con (slug)                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Ăn uống `food`                | Ăn sáng `food.breakfast`, Ăn trưa `food.lunch`, Ăn tối `food.dinner`, Cà phê `food.coffee` |
| Nhà ở `home`                  | Tiền nhà `home.rent`, Điện `home.electric`, Nước `home.water`, Internet `home.internet`    |
| Di chuyển `move`              | Grab `move.grab`, Xăng `move.fuel`, Gửi xe `move.parking`                                  |
| Mua sắm `shop`                | Đi chợ `shop.grocery`, Quần áo `shop.clothes`, Đồ dùng `shop.goods`                        |
| Giải trí `fun`                | Netflix `fun.netflix`, Spotify `fun.spotify`, Xem phim `fun.movie`                         |
| Sức khỏe `health`             | Thuốc `health.medicine`, Gym `health.gym`                                                  |
| Thu nhập `income` (type `in`) | Lương `income.salary`, Thưởng `income.bonus`, Khác `income.other`                          |

**`transactions`**

| Cột                  | Kiểu              | Ghi chú                                           |
| -------------------- | ----------------- | ------------------------------------------------- |
| id                   | uuid pk           |                                                   |
| userId               | fk user           | index (userId, date)                              |
| type                 | `'out' \| 'in'`   |                                                   |
| amount               | bigint            | VND, số nguyên dương                              |
| categoryId           | fk categories     | thường là danh mục con                            |
| store                | text, null        |                                                   |
| note                 | text, null        |                                                   |
| date                 | date              |                                                   |
| source               | `'app' \| 'zalo'` |                                                   |
| receiptKey           | text, null        | key ảnh trên R2                                   |
| deletedAt            | timestamptz, null | xóa mềm; mọi truy vấn đọc lọc `deletedAt is null` |
| createdAt, updatedAt | timestamptz       |                                                   |

**`zalo_links`**: `zaloUserId` (pk), `userId` (unique), `displayName`, `linkedAt`.

**`zalo_link_codes`**: `code` (pk, 6 ký tự A–Z0–9 bỏ ký tự dễ nhầm), `userId`, `expiresAt` (+10 phút), `usedAt` null. Tạo mã mới thì vô hiệu mã cũ chưa dùng của user đó.

**`zalo_updates`**: `updateId` (pk), `receivedAt`. Chống xử lý trùng khi Zalo gửi lại webhook.

## 6. Parser nhập nhanh (`lib/parse-quick.ts`)

Port `parseQuick`, `isQuestion`, `KW`, `STORES` từ prototype, với các thay đổi:

- Trả `categorySlug` thay vì `cat`/`sub` tên. Bảng `KW` map regex → slug. Khi regex chỉ khớp danh mục gốc (ví dụ "ăn uống"), dùng con đầu tiên của gốc đó như prototype.
- Thêm `confidence: 'high' | 'low'`: `low` khi không khớp keyword nào (rơi về `shop.goods`).
- Nhận tham số `today` (chuỗi `YYYY-MM-DD` theo giờ VN) thay vì hằng `TODAY`; "hôm qua" = today − 1.
- Trả `null` khi không tìm được số tiền.
- Phía server, slug được map sang `categoryId` của user. Nếu user đã xóa danh mục ứng với slug thì dùng `shop.goods`; nếu cả nó cũng không còn thì dùng danh mục gốc `out` đầu tiên của user.

Test bắt buộc (Vitest), với today = `2026-10-14`:

| Input                                       | Kỳ vọng                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `ăn phở 45k`                                | out, 45000, `food.breakfast`, date 2026-10-14        |
| `grab 32k hôm qua`                          | out, 32000, `move.grab`, store Grab, date 2026-10-13 |
| `trà sữa 55k ở Phúc Long`                   | out, 55000, `food.coffee`, store "Phúc Long"         |
| `nhận lương 25tr`                           | in, 25000000, `income.salary`                        |
| `1,5tr`                                     | 1500000, confidence low                              |
| `Tháng này mình tiêu bao nhiêu cho cà phê?` | `isQuestion` = true                                  |

## 7. UI

Bám handoff README (màu, font, spacing, radius, motion, copy). Những điểm khác:

**Theme**: ghi đè biến HeroUI trong `src/app/styles/index.css` bằng giá trị token TH cho light và dark (`[data-theme='dark']`). Token TH không có trong HeroUI (màu category, shadow, radius 20/24/28/32, motion) khai báo thành biến riêng và map vào `@theme` của Tailwind. Font: Space Grotesk + IBM Plex Mono qua `next/font`, bỏ Inter. Mọi số tiền đi qua một component `<Money>` (font mono, dấu `−` U+2212 cho chi, `+` và màu success cho thu).

**App shell** (`(main)/layout.tsx`):

- ≥900px: sidebar nổi 248px, nav chỉ gồm Tổng quan, Giao dịch, Danh mục, Cài đặt.
- <900px: tab bar đáy gồm Tổng quan, Giao dịch, [+], Danh mục, Cài đặt; tôn trọng safe-area.
- Sheet Thêm/Sửa mở bằng search param `?tx=new` hoặc `?tx=<id>`; `ResponsiveSheet` = HeroUI Modal (desktop) / Drawer đáy (mobile).
- Toast HeroUI top-center, tự tắt 3,2s, nút "Hoàn tác" khi thêm/xóa.

**Màn hình**:

- **Login**: theo design. Email ngoài allowlist → `/login?error=not_invited`, hiện "Email này chưa được mời dùng Sổ Chi".
- **Tổng quan**: header (ngày, "Chào {tên}", nút ngôn ngữ + theme; mobile có avatar → Cài đặt). Ô nhập nhanh không có mic; câu hỏi → nút disable + caption "Hỏi đáp sắp có". Stat cards: "Đã chi tháng X" (delta so với cùng khoảng ngày tháng trước), "Thu nhập" + "Còn lại", card thứ ba là **card Zalo** (chưa liên kết → "Liên kết Zalo" sang Cài đặt; đã liên kết → hướng dẫn tag bot). Chỉ có list "Gần đây" (6), full width; bỏ "Sắp đến hạn".
- **Giao dịch**: theo design. Filter kỳ/danh mục/số tiền/cửa hàng nằm trên URL và xử lý ở server; ô search lọc trên client trong danh sách đã tải. Kỳ "Tất cả" tải theo tháng với nút "Xem thêm". Giao dịch nguồn Zalo có icon nhỏ; có hóa đơn thì có icon ảnh, bấm xem qua signed URL R2.
- **Sheet Thêm/Sửa**: theo design, bỏ switch "Lặp lại hàng tháng"; có thumbnail hóa đơn nếu có. Xóa = xóa mềm + toast "Hoàn tác".
- **Danh mục**: theo design (thêm gốc/con, xóa con bằng × trên tag). Xóa con đang có giao dịch → xác nhận, chuyển giao dịch lên danh mục cha. Chưa cho xóa gốc, chưa sửa icon/màu.
- **Cài đặt**: profile, link Danh mục, switch Giao diện tối, Đăng xuất, và card **Liên kết Zalo**: chưa liên kết → "Tạo mã liên kết" → mã + đếm ngược 10 phút + "Nhắn riêng cho bot: `/link ABC123`"; đã liên kết → tên Zalo + "Hủy liên kết".

**i18n**: mọi copy nằm trong `messages/vi.json` và `messages/en.json`. Nhãn ngày theo locale ("Hôm nay"/"Today", "T2, 12/10"/"Mon, 12/10"). Tên danh mục là dữ liệu user, không dịch. Parser chỉ hiểu tiếng Việt.

## 8. Zalo bot

**Một bot cố định**: app chỉ dùng một bot, xác định bằng `ZALO_BOT_TOKEN`; tên hiển thị của bot là hằng số trong code (dùng để bỏ phần @tag).

**Đã biết về Zalo Bot Platform** (từ chủ dự án): bot vào được group; chỉ gọi webhook khi bot được tag; tin có ảnh kèm link ảnh; mỗi tin là độc lập, bot không đọc được tin trước. Hình dạng payload, header secret và API gửi tin phải kiểm tra lại với docs Zalo Bot khi lập plan Phase 3.

**Luồng `POST /api/zalo/webhook`**:

1. Header secret ≠ `ZALO_WEBHOOK_SECRET` → 401.
2. Insert `zalo_updates`; trùng → 200, dừng.
3. Trả 200 ngay; phần còn lại chạy trong `after()`.
4. Bỏ phần tag bot khỏi nội dung, rồi phân loại:

| Tin                                             | Điều kiện    | Xử lý                                                                                                                            |
| ----------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `/link CODE`                                    | chỉ chat 1-1 | Mã hợp lệ + chưa dùng + chưa hết hạn → tạo `zalo_links`, đánh dấu `usedAt`. Trong group → "Nhắn riêng cho mình để liên kết nhé". |
| bất kỳ, Zalo ID chưa liên kết                   |              | "Nhắn riêng cho mình để liên kết tài khoản trước nhé" (kèm hướng dẫn lấy mã trong Cài đặt)                                       |
| `/undo`                                         |              | Xóa mềm giao dịch `source='zalo'` mới nhất của user tạo trong 10 phút                                                            |
| câu hỏi (`isQuestion`, có `?` hoặc không có số) |              | "Hỏi đáp sắp có"                                                                                                                 |
| chữ                                             |              | `parseQuick`; `null` → hướng dẫn cú pháp; `confidence: low` → `ai.parseText`; tạo giao dịch                                      |
| ảnh                                             |              | tải ảnh (≤10MB) → R2 → `ai.parseReceipt` → `isReceipt && total` thì tạo giao dịch                                                |

5. Mọi tin trả lời gửi với `parse_mode: 'html'` (chỉ dùng các thẻ Zalo hỗ trợ: `b`, `i`, `u`, `s`, `p`, `ul/ol/li`…); nội dung của người dùng (ghi chú, cửa hàng, tên danh mục) luôn được escape HTML. Trả lời xác nhận: `✓ {Gốc} › {Con} · −45.000 ₫ · Hôm nay` + `Gõ /undo để hủy`. Ảnh: thêm dòng note tóm tắt món.

**Tin trả lời lỗi** (luôn tiếng Việt):

| Tình huống                                 | Trả lời                                                       |
| ------------------------------------------ | ------------------------------------------------------------- |
| Không có số tiền                           | "Mình chưa hiểu số tiền. Thử: `ăn phở 45k`"                   |
| Ảnh không phải hóa đơn / không đọc ra tổng | "Mình không đọc được tổng tiền, bạn gõ tay giúp nhé"          |
| Ảnh >10MB hoặc tải lỗi                     | "Ảnh lỗi, gửi lại giúp mình nhé"                              |
| Lỗi Claude/DB                              | "Có lỗi, thử lại sau nhé" + log                               |
| `/undo` không còn gì                       | "Không có giao dịch nào để hoàn tác"                          |
| Mã sai/hết hạn                             | "Mã không đúng hoặc đã hết hạn, tạo mã mới trong Cài đặt nhé" |

Gửi tin trả lời thất bại → chỉ log, không retry (giao dịch đã lưu).

## 9. Claude (`server/ai/`)

- Model `claude-opus-5-5`, `output_config.effort: "low"`, structured outputs qua `messages.parse` + schema zod, bật `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Model là một hằng số config.
- Kiểm tra `stop_reason === "refusal"` trước khi đọc kết quả; refusal → coi như không đọc được.
- **`parseText(text, { today, categories })`** → `{ type, amount, categorySlug | categoryId, store?, note?, date }`. `categories` là danh sách danh mục của user (id, slug, tên, type); schema giới hạn giá trị chọn trong danh sách đó.
- **`parseReceipt(imageBytes, mediaType, { today, categories })`** → `{ isReceipt, total?, store?, date?, categoryId?, note? }`. `note` tóm tắt món (ví dụ "Phở bò, trà đá ×2"). Ngày trên hóa đơn không đọc được → today.
- Tra cứu cú pháp SDK trong skill `claude-api` khi lập plan Phase 3, không viết theo trí nhớ.

## 10. Biến môi trường

Thêm `ALLOWED_EMAILS` (danh sách email cách nhau dấu phẩy, so sánh không phân biệt hoa thường) vào `src/configs/env.ts` và `.env.example`. Các biến Zalo, Anthropic, R2 đã có sẵn.

## 11. Testing

- Thêm Vitest.
- Unit: `lib/parse-quick.ts` (bảng ở mục 6), `lib/format.ts` (tiền, rút gọn "12,9tr"/"450k", nhãn ngày cả vi và en).
- Webhook handler: mock `services` và `ai`; phủ các nhánh link (1-1 và group), chưa liên kết, undo, chữ (high/low confidence, không có số tiền), ảnh (hóa đơn, không phải hóa đơn, lỗi tải), update trùng, secret sai.
- Services: chạy với Postgres thật (database `expense_test`), phủ việc lọc theo `userId`, xóa mềm/hoàn tác, xóa danh mục con chuyển giao dịch lên cha, map slug → category.
- Thủ công: so từng màn với prototype (light/dark, ≥900px và <900px); thử bot qua `pnpm tunnel`.

## 12. Các phase

Mỗi phase có plan riêng, dùng được và kiểm thử được độc lập.

**Phase 1: Nền tảng**
Vitest; theme TH trên HeroUI + font + lucide; DB schema + migration Drizzle; better-auth Google + allowlist + seed danh mục; app shell (sidebar/tab bar, nav, nút ngôn ngữ/theme); login theo design; `ResponsiveSheet`, `Money`, toast.
_Xong khi:_ đăng nhập được bằng email trong allowlist, email ngoài bị chặn, thấy shell đúng design ở cả hai breakpoint và hai theme, DB có danh mục seed.

**Phase 2: Giao dịch cá nhân trên app**
`lib/parse-quick`, `lib/format` + test; services transactions/categories + test; Tổng quan (trừ card Zalo hiện ở trạng thái chưa liên kết), Giao dịch, sheet Thêm/Sửa, Danh mục, Cài đặt (trừ card Zalo); copy vi/en.
_Xong khi:_ ghi/sửa/xóa/hoàn tác giao dịch qua nhập nhanh và sheet, lọc và tìm được, quản lý danh mục được.

**Phase 3: Zalo bot**
Bảng Zalo; card Liên kết Zalo trong Cài đặt + card Zalo ở Tổng quan; webhook + handler; `ai.parseText`, `ai.parseReceipt`; lưu R2 + xem hóa đơn trong app; test handler.
_Xong khi:_ liên kết được qua chat 1-1, tag bot trong group bằng chữ hoặc ảnh tạo đúng giao dịch, `/undo` hoạt động, giao dịch Zalo hiện trên app kèm hóa đơn.
