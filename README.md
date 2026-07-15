# Xưởng 81 Hồ Văn Huê — App quản lý xưởng may

Ứng dụng web (PWA) quản lý đơn hàng và sản lượng cho xưởng may. Dùng trên
điện thoại: **chủ xưởng (admin)** tạo/quản lý đơn, **công nhân (worker)**
nhận đơn và báo hoàn thành. Dữ liệu đồng bộ realtime giữa các thiết bị.

- **Production:** https://xuong-81-ho-van-hue.vercel.app
- **Đăng nhập bằng mã PIN:** Admin `1234` · Công nhân `5678`

---

## 1. Công nghệ

| Thành phần | Dùng gì |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| CSS | Thuần (`src/app/globals.css`), mobile-first, tối đa 480px |
| Database | Supabase (PostgreSQL) — gọi thẳng từ client qua `@supabase/supabase-js` |
| Đăng nhập | Chỉ PIN (không mật khẩu), lưu phiên trong `localStorage` |
| Đồng bộ | Supabase Realtime + poll mỗi 2 giây (hook `useAutoRefresh`) |
| Thông báo | Web Push (VAPID + `web-push`) qua API route + thông báo trong app |
| Ảnh sản phẩm | Nén client (tối đa 800px, JPEG) rồi lưu **base64 trong DB** (không dùng Storage) |
| Hosting | Vercel (tự deploy khi push GitHub) |

> Không dùng: Firebase, auth mật khẩu/email, backend server riêng. Chỉ có
> đúng **1 API route** (`/api/send-push`) chạy trên Vercel để gửi push.

---

## 2. Chạy trên máy (local)

```bash
npm install
# Tạo file .env.local (xem mục 4) rồi:
npm run dev      # chạy dev tại http://localhost:3000
# hoặc build production:
npm run build && npm start
```

---

## 3. Cấu trúc thư mục

```
src/
  app/
    page.tsx            # Điều hướng: chưa đăng nhập -> /dang-nhap
    layout.tsx          # Root layout + đăng ký service worker (sw.js)
    globals.css         # Toàn bộ CSS của app
    dang-nhap/          # Màn đăng nhập PIN + hộp thoại xin quyền thông báo
    don-hang/           # ⭐ Màn Đơn hàng (admin) / Đơn cần may (worker) — file lớn nhất
    tao-don/            # Tạo đơn mới + Sửa đơn (?edit=<id>)
    san-pham/           # Quản lý danh mục + sản phẩm (chỉ admin)
    nhap-san-luong/     # Công nhân nhập sản lượng thủ công
    lich-su/            # Lịch sử sản lượng theo ngày
    bao-cao/            # Báo cáo tháng (chỉ admin)
    api/send-push/      # API gửi Web Push (serverless)
  components/
    BottomNav.tsx       # Thanh điều hướng dưới cùng
  lib/
    supabaseClient.ts   # Khởi tạo Supabase client
    supabaseService.ts  # Các hàm đọc/ghi Supabase
    AuthContext.tsx     # Đăng nhập PIN + phiên
    mockData.ts         # Định nghĩa type (User, Product, Order, ...) + helper
    useAutoRefresh.ts   # Hook realtime + poll 2s + refetch khi quay lại tab
    pushNotifications.ts# Xin quyền + đăng ký Web Push
  types/web-push.d.ts   # Khai báo type cho thư viện web-push
public/
  sw.js                 # Service worker (push + notificationclick, KHÔNG cache)
  manifest.json, icon-192.png, icon-512.png
supabase-*.sql          # Các script SQL chạy tay trên Supabase (xem mục 5)
```

---

## 4. Biến môi trường (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid public>
VAPID_PRIVATE_KEY=<vapid private>
```

- `.env.local` **không commit** (đã có trong `.gitignore`).
- Sinh VAPID keys: `npx web-push generate-vapid-keys --json`
- 4 biến này cũng phải được đặt trên **Vercel** (Production + Preview).

---

## 5. Cơ sở dữ liệu (Supabase)

Không dùng Supabase CLI. Mọi thay đổi schema là các file `supabase-*.sql`
ở gốc repo, **dán vào Supabase Dashboard → SQL Editor → Run**.

Khi dựng lại từ đầu, chạy theo thứ tự:

1. `supabase-migration.sql` — tạo toàn bộ bảng, RLS, và dữ liệu mẫu.
2. `supabase-enable-realtime.sql` — bật realtime cho `orders` + `production_logs`.
3. `supabase-add-color-images.sql` — thêm cột `products.color_images` (ảnh theo màu).
4. `supabase-add-push-subscriptions.sql` — tạo bảng `push_subscriptions`.

Tiện ích: `supabase-clean.sql` — xoá sạch dữ liệu, giữ cấu trúc (dùng khi reset demo).

### Các bảng

- **users** — `id, name, role('admin'|'worker'), pin`
- **categories** — danh mục sản phẩm (icon, màu, thứ tự)
- **products** — sản phẩm; `colors[]`, `sizes[]`, `main_image_url` (base64), `color_images` (jsonb: ảnh theo màu)
- **product_variants** — biến thể theo màu+size của sản phẩm
- **orders** — đơn hàng; `status('pending'|'done')`, `priority('normal'|'urgent')`, `remaining_quantity` (cho "xong một phần")
- **production_logs** — nhật ký sản lượng (nguồn dữ liệu cho Lịch sử + Báo cáo)
- **push_subscriptions** — 1 dòng/user (`id = user_id`), lưu subscription Web Push

> RLS bật cho tất cả bảng nhưng policy là "cho phép tất cả" (app nội bộ, bảo
> vệ bằng anon key). Đây là app nội bộ quy mô nhỏ, không có phân quyền chặt ở DB.

---

## 6. Chức năng chính

- **Đăng nhập PIN** → admin vào quản lý, worker vào nhận đơn.
- **Đơn hàng** (`don-hang`): 2 tab **Chờ may / Đã xong** (cả admin lẫn worker).
  - Admin: tạo đơn, đánh dấu gấp, ghim lên đầu, sửa, xoá, chuông thông báo đơn hoàn thành.
  - Worker: bấm **Xong hết** / **Xong một phần** → ghi `production_logs`, đơn chuyển sang tab Đã xong.
- **Tạo/sửa đơn** (`tao-don`): chọn danh mục → sản phẩm → size/màu/số lượng/ưu tiên/hạn/ghi chú.
- **Sản phẩm** (`san-pham`, admin): thêm/sửa/xoá sản phẩm, ảnh chung + ảnh theo màu.
- **Nhập sản lượng** (`nhap-san-luong`): công nhân nhập tay số lượng đã may.
- **Lịch sử** (`lich-su`) + **Báo cáo tháng** (`bao-cao`): đọc từ `production_logs`.
- **Thông báo**: đơn mới → báo cho worker; đơn xong → báo cho admin.
  - **Web Push** (khi đóng app) + **thông báo trong app** (banner + bíp + rung, khi đang mở app).
  - Nút 🔔 trên header worker để bật/kiểm tra thông báo.

---

## 7. Triển khai (deploy)

Repo đã kết nối Vercel qua GitHub. **Push lên nhánh mặc định của GitHub là
Vercel tự build + deploy.**

⚠️ Lưu ý nhánh git: nhánh local là **`main`**, nhưng nhánh mặc định trên
GitHub là **`master`**. Push bằng:

```bash
git push origin main:master
```

Sau khi push ~1 phút, mở lại app trên điện thoại (đóng hẳn rồi mở lại) để
nhận bản mới — `sw.js` không cache nên không cần xoá thủ công.
