# TH Expense

Web app quản lý chi tiêu cá nhân và nhóm, tích hợp bot Zalo: nhắn tin hoặc gửi ảnh hóa đơn vào nhóm Zalo, bot tự đọc và ghi chi tiêu.

## Stack

Next.js 16 (App Router) · HeroUI v3 · Tailwind 4 · Postgres + Drizzle · better-auth · Claude API · Cloudflare R2

## Chạy local

```bash
pnpm install
cp .env.example .env.local   # điền các biến
pnpm dev
```

Webhook Zalo cần URL HTTPS công khai, dev dùng ngrok với domain tĩnh (làm một lần):

1. `brew install ngrok`, đăng ký tài khoản ngrok rồi chạy `ngrok config add-authtoken <token>`
2. Lấy static domain miễn phí tại dashboard ngrok → **Domains**
3. Đặt `DEV_TUNNEL_HOST=<domain>` trong `.env.local`
4. Cấu hình webhook của bot thành `https://<domain>/api/zalo/webhook`

Sau đó chạy song song với `pnpm dev`:

```bash
pnpm tunnel
```

## Scripts

| Lệnh             | Mô tả                            |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Dev server                       |
| `pnpm tunnel`    | Mở tunnel HTTPS cho webhook Zalo |
| `pnpm lint`      | oxlint                           |
| `pnpm format`    | oxfmt                            |
| `pnpm typecheck` | Kiểm tra kiểu                    |
| `pnpm build`     | Build production                 |
