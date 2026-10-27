# Nối app Xưởng 81 với Pancake — việc chủ xưởng phải tự làm

Thiết kế: `docs/superpowers/specs/2026-10-27-ket-noi-pancake-design.md`
Kế hoạch: `docs/superpowers/plans/2026-10-27-ket-noi-pancake.md`

Ba việc dưới đây máy của người làm không tự làm được, vì không có mật khẩu.

---

## 1. Chạy SQL trên Supabase — ĐÃ XONG 27/10/2026

File `supabase-pancake.sql`, dán vào Supabase → SQL Editor → Run.
Kiểm lại bất cứ lúc nào: `node scripts/kiem-tra-migration.mjs`

## 2. Điền Webhook bên Pancake

Vào Pancake POS → **Cấu hình → Cấu hình ứng dụng → Webhook/API**, thêm một webhook:

| Ô           | Điền                                                              |
| ----------- | ----------------------------------------------------------------- |
| Loại dữ liệu | `orders`                                                          |
| URL         | `https://xuong-81-ho-van-hue.vercel.app/api/pancake/webhook`      |
| Headers     | `x-xuong81-secret: <giá trị PANCAKE_WEBHOOK_SECRET trong .env.local>` |

Lưu ý: nếu URL trả lỗi, **Pancake tự tắt webhook của shop**. App luôn trả 200 kể cả
khi payload méo, chính là để tránh chuyện đó. Ngoài ra mỗi đêm còn một lượt đối chiếu
lại đơn 24 giờ qua, nên webhook hỏng cũng không mất đơn.

## 3. Đặt biến môi trường

### Trên Vercel (Settings → Environment Variables → Production)

| Tên                      | Giá trị                                  |
| ------------------------ | ---------------------------------------- |
| `PANCAKE_API_KEY`        | khoá API của shop                        |
| `PANCAKE_WEBHOOK_SECRET` | chuỗi bí mật, giống hệt ô Headers ở trên |
| `CRON_SECRET`            | chuỗi bí mật cho bộ hẹn giờ              |
| `PANCAKE_DRY_RUN`        | `1` khi còn muốn chạy thử · `0` để chạy thật |

Lấy đúng giá trị trong `.env.local` ở máy. Đặt bằng bash, **không dùng PowerShell**
(PowerShell thêm ký tự xuống dòng làm hỏng giá trị):

```bash
printf '%s' 'gia-tri' | vercel env add PANCAKE_API_KEY production
```

Đổi biến xong phải deploy lại thì hàm mới nhận giá trị mới.

### Trên GitHub (Settings → Secrets and variables → Actions)

| Tên                      | Giá trị                                        |
| ------------------------ | ---------------------------------------------- |
| `APP_URL`                | `https://xuong-81-ho-van-hue.vercel.app`       |
| `CRON_SECRET`            | giống hệt trên Vercel                          |
| `PANCAKE_WEBHOOK_SECRET` | giống hệt trên Vercel                          |

---

## Bộ hẹn giờ chạy những gì

File `.github/workflows/hen-gio.yml`. Giờ ghi theo UTC, Việt Nam = UTC+7.

| Việc                    | Giờ VN     |
| ----------------------- | ---------- |
| Nhắc buổi sáng          | 7h30       |
| Nhắc buổi chiều         | 14h00      |
| Đồng bộ danh mục mẫu mã | 2h00       |
| Đánh thức Supabase      | 12h00      |
| Xả hàng đợi nhập kho    | mỗi 5 phút |

Chạy tay được: GitHub → Actions → "Hẹn giờ Xưởng 81" → Run workflow → chọn việc.

## Công tắc tắt khẩn cấp

Đặt `PANCAKE_DRY_RUN=1` trên Vercel rồi deploy lại: app làm đủ mọi thứ trừ việc ghi
thật sang Pancake. Dùng khi nghi có gì đó sai mà chưa kịp tìm ra.

## Đã chạy thử trên shop thật (27/10/2026)

Phiếu nhập mã **2287**, 1 cái mẫu A208-DEN-M: tồn 0 → 1 → huỷ phiếu → 0.
Phiếu đã ở trạng thái Canceled. Đường ghi sang Pancake chạy đúng và huỷ phiếu có
hoàn tồn.
