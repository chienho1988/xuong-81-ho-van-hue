# CLAUDE.md — Hướng dẫn cho AI agent khi làm việc với repo này

App quản lý xưởng may "Xưởng 81 Hồ Văn Huê". Đọc `README.md` để hiểu tổng
quan. File này ghi lại **quy ước + các cạm bẫy đã gặp** để không vấp lại.

Người dùng trao đổi bằng **tiếng Việt**; UI toàn tiếng Việt, mobile-first.

---

## Kiến trúc nhanh

- Next.js 14 App Router, React client components (`'use client'`), TypeScript.
- Đọc/ghi DB gọi **thẳng Supabase từ client** (`src/lib/supabaseClient.ts` + `supabaseService.ts`). Không có backend riêng, trừ đúng 1 API route `/api/send-push`.
- Đăng nhập chỉ bằng **PIN** (`AuthContext`), lưu phiên ở `localStorage['xuong81_session']`. Admin `1234`, worker `5678`.
- Đồng bộ realtime: hook `useAutoRefresh` (realtime + poll 2s + refetch khi focus/visible). Callback bị "đóng băng" trong closure của useEffect → **nếu cần state mới nhất bên trong callback, dùng `useRef`** (xem cách `don-hang` phát hiện đơn mới).
- File `src/app/don-hang/page.tsx` là **file lớn và quan trọng nhất** — chứa cả view admin lẫn worker, tách bằng `isAdmin`.

---

## ⚠️ Cạm bẫy schema (RẤT HAY VẤP)

- Bảng **`products` KHÔNG có cột `variants`** — variants nằm ở bảng riêng `product_variants`. Gửi kèm key `variants` vào `products.upsert()` sẽ bị PostgREST **từ chối cả payload** (đã gây bug "không lưu được sản phẩm").
- Bảng **`orders` KHÔNG có cột `updated_at`** (tài liệu thiết kế có nhắc nhưng schema thật chưa từng tạo). Đừng ghi field này.
- Ảnh lưu **base64 trực tiếp trong DB** (cột `main_image_url`, `color_images`, `product_variants.image_url`), **không dùng Supabase Storage**. Luôn nén trước bằng `compressImage` (tối đa 800px, JPEG ~0.72) — hàm có sẵn trong `san-pham/page.tsx`.
- `color_images` là `jsonb`, key = tên màu. Lấy ảnh theo đơn: `color_images[order.color]` fallback `main_image_url`.

## ⚠️ Migration Supabase

- **Không có Supabase CLI, không có DB password, không có service_role key** trong môi trường này → **không thể chạy DDL từ máy**. Anon key chỉ CRUD được (RLS allow-all), không đổi được schema.
- Viết migration thành file `supabase-*.sql` ở gốc repo, rồi **nhắc user tự dán vào Supabase SQL Editor**. Không tự apply, không hứa đã chạy.
- **Viết code chịu được trạng thái trước-migration**: thử upsert lại không kèm cột mới nếu lỗi, dùng `select('*')` thay vì liệt kê cột mới (xem cách xử lý `color_images` khi cột chưa có).
- Kiểm tra cột đã tồn tại chưa bằng REST:
  ```
  GET {SUPABASE_URL}/rest/v1/products?select=<col>&limit=1  (apikey header)
  # trả 42703 "column ... does not exist" nếu chưa migrate
  ```

## ⚠️ Git & Deploy

- Nhánh local là **`main`**, nhánh mặc định GitHub là **`master`**. Push bằng: `git push origin main:master`. Người dùng đã cho phép push để deploy.
- Vercel project `xuong-81-ho-van-hue`, nối GitHub, **auto-deploy khi push**. Production: https://xuong-81-ho-van-hue.vercel.app
- Commit message rõ ràng, bằng tiếng Anh, kết bằng:
  `Co-Authored-By: Claude ... <noreply@anthropic.com>`
- Trên Windows, dùng file cho commit message dài (`git commit -F msg.txt`) — here-string của PowerShell hay bị PowerShell cắt sai.

## ⚠️ Vercel env vars

- Đặt qua **bash `printf '%s' 'value' | vercel env add NAME production`**. **KHÔNG** dùng PowerShell pipe (`"val" | vercel env add`) — nó nối thêm CRLF, Vercel chỉ cắt `\n` nên còn lại `\r` làm **hỏng giá trị** (đã làm hỏng VAPID key một lần → push báo "Vapid public key invalid").
- Đổi env xong phải **`vercel redeploy <url>`** hoặc push mới để function nhận giá trị mới.

---

## Web Push (đã có sẵn)

- `public/sw.js` (listener `push` + `notificationclick`, không cache) — `layout.tsx` đăng ký nó.
- `/api/send-push` nhận `{role, title, body}`, query `push_subscriptions` theo role, gửi bằng `web-push` với VAPID env, tự xoá subscription hết hạn (404/410).
- `pushNotifications.ts`: `getPushState()`, `enablePush(userId)`, `ensurePushSubscription`. Bấm nút 🔔 header (worker) để bật; xử lý mọi trạng thái quyền (default/denied/granted/unsupported).
- Gửi push kiểu **fire-and-forget** sau khi thao tác chính thành công — lỗi push không được chặn luồng chính.
- **Thông báo trong app** (worker): banner + Web Audio bíp + `navigator.vibrate` khi có đơn mới lúc app đang mở (vì push hệ thống hay bị nuốt ở foreground).

---

## Chạy test E2E (Playwright)

- Playwright đã cài trong dev deps. Test chạy với **`node <file>.mjs`** (không phải `playwright test`).
- Import trong file scratchpad: `import { chromium } from 'file:///E:/Quan%20ly%20xuong%20may/node_modules/playwright/index.mjs'`.
- Test đối chiếu với **`npm start`** (build production) ở **port 3100** — start ở background, chờ port sẵn sàng (`until curl -s -o /dev/null http://localhost:3100/...`).
- Điều khiển permission thông báo: headless Chromium ép `Notification.permission = 'denied'` và **chặn Push API ở chế độ ẩn danh** (crbug.com/41124656) → không test được đường subscribe thật; cần điện thoại thật.
- **Cạm bẫy môi trường:** binary `chrome-headless-shell` của Playwright có thể **thiếu `icudtl.dat`** → launch lỗi `Invalid file descriptor to ICU data received`. Khắc phục: copy `icudtl.dat` từ Opera/VSCode Electron vào thư mục binary, rồi tự spawn chrome với `--remote-debugging-port` và dùng `chromium.connectOverCDP(...)` (né được lỗi fd-passing của `launch`).
- Dọn dẹp: sau test luôn xoá đơn/log test đã tạo qua REST; dừng server port 3100.

## Quy trình chuẩn cho mỗi thay đổi

1. Đọc kỹ file liên quan trước khi sửa (đặc biệt `don-hang/page.tsx`).
2. Sửa nhỏ, đúng phạm vi yêu cầu; giữ nguyên style/UX hiện có.
3. `npm run build` — phải pass (TypeScript + lint).
4. E2E bằng Playwright với dữ liệu thật trên Supabase, có screenshot khi cần.
5. Commit (message tiếng Anh rõ ràng) → `git push origin main:master`.
6. Xác nhận Vercel deploy Ready + kiểm tra bundle production chứa thay đổi.
7. Nếu có migration: nhắc user chạy SQL trên Supabase, và đảm bảo code không vỡ khi chưa migrate.
