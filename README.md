# Sổ Chi

Web app quản lý chi tiêu cá nhân và nhóm, tích hợp bot Zalo: nhắn tin hoặc gửi ảnh hóa đơn vào nhóm Zalo, bot tự đọc và ghi chi tiêu.

## Stack

Next.js 16 (App Router) · HeroUI v3 · Tailwind 4 · Postgres + Drizzle · better-auth · Claude API · Cloudflare R2

## Trạng thái

- Phase 1: nền tảng và đăng nhập Google giới hạn theo email.
- Phase 2 (xong): giao dịch cá nhân trên app. Nhập nhanh bằng câu tiếng Việt (ví dụ "ăn phở 45k"), thêm/sửa/xóa kèm hoàn tác, danh sách có lọc, tìm kiếm và nhóm theo ngày, quản lý danh mục, trang cài đặt (hồ sơ, giao diện).
- Phase 3: bot Zalo và đọc ảnh hóa đơn bằng Claude.

## Chạy local

Cần Node, pnpm và Docker.

```bash
pnpm install
docker compose up -d --wait   # Postgres ở localhost:5433, tự tạo DB expense và expense_test
cp .env.example .env.local    # điền các biến
pnpm db:migrate
pnpm dev
```

### Biến môi trường

- `BETTER_AUTH_SECRET`: tạo bằng `openssl rand -base64 32`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: tạo OAuth client trên Google Cloud Console và thêm redirect URI `http://localhost:3000/api/auth/callback/google`.
- Các biến Zalo, Anthropic, R2 và `CRON_SECRET` là tùy chọn cho đến Phase 3, chưa cần để chạy app.

Webhook Zalo cần URL HTTPS công khai, dev dùng ngrok với domain tĩnh (làm một lần):

1. `brew install ngrok`, đăng ký tài khoản ngrok rồi chạy `ngrok config add-authtoken <token>`
2. Lấy static domain miễn phí tại dashboard ngrok → **Domains**
3. Đặt `DEV_TUNNEL_HOST=<domain>` trong `.env.local`
4. Cấu hình webhook của bot thành `https://<domain>/api/zalo/webhook`

Sau đó chạy song song với `pnpm dev`:

```bash
pnpm tunnel
```

## Bot Zalo

Biến môi trường (xem `.env.example`): `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET` (8-256 ký tự, Zalo gửi lại trong header `X-Bot-Api-Secret-Token`), `OPENAI_API_KEY`, các biến `R2_*` và `CRON_SECRET` (tối thiểu 16 ký tự).

Đăng ký webhook khi dev: chạy `pnpm tunnel` (cần `DEV_TUNNEL_HOST`, xem trên), rồi `pnpm zalo:webhook`. Lệnh này gọi `setWebhook` tới `https://<DEV_TUNNEL_HOST>/api/zalo/webhook`; có thể truyền URL gốc khác: `pnpm zalo:webhook https://example.com`.

Liên kết tài khoản: vào Cài đặt › Liên kết Zalo để lấy mã, rồi nhắn `/link <mã>` cho bot Zalo. Từ đó tin nhắn và ảnh hóa đơn của tài khoản Zalo đó được ghi vào chi tiêu của bạn.

Dọn dữ liệu: đặt cron hằng ngày gọi `GET /api/cron/cleanup` với header `Authorization: Bearer $CRON_SECRET` (Vercel Cron tự gửi header này khi `CRON_SECRET` được đặt trong project).

## Scripts

| Lệnh                | Mô tả                                                    |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Dev server                                               |
| `pnpm tunnel`       | Mở tunnel HTTPS cho webhook Zalo                         |
| `pnpm zalo:webhook` | Đăng ký webhook của bot Zalo                             |
| `pnpm test`         | Chạy toàn bộ test: unit + DB (cần Postgres trong Docker) |
| `pnpm test:unit`    | Chỉ unit test, không cần DB                              |
| `pnpm db:generate`  | Sinh migration từ schema Drizzle                         |
| `pnpm db:migrate`   | Áp migration vào DB                                      |
| `pnpm db:studio`    | Drizzle Studio: xem và sửa DB trên trình duyệt           |
| `pnpm lint`         | oxlint                                                   |
| `pnpm format`       | oxfmt                                                    |
| `pnpm typecheck`    | Kiểm tra kiểu                                            |
| `pnpm build`        | Build production                                         |
