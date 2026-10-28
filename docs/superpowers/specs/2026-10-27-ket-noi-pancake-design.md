# Thiết kế: Nối app Xưởng 81 với Pancake POS

Ngày: 27/10/2026
Trạng thái: chờ chủ xưởng duyệt

---

## 1. Mục đích và lý do

Hiện tại khi Pancake báo một đơn thiếu hàng (dòng vàng), chủ xưởng phải **tự mở app
xưởng và gõ lại lệnh may bằng tay**. Khi thợ may xong, chủ xưởng lại phải **tự vào
Pancake gõ phiếu nhập kho**. Hai lần gõ tay này đều là chép lại dữ liệu đã có sẵn ở
nơi khác — tốn thời gian và dễ sai số.

Bản nâng cấp này xoá hai thao tác đó. Pancake và app xưởng tự nói chuyện với nhau.

Cách làm việc của xưởng **không đổi**: thợ vẫn mở app, vẫn thấy danh sách đơn cần may,
vẫn bấm Xong. Cái đổi là đơn tự xuất hiện và tồn kho tự cập nhật.

---

## 2. Mục tiêu

1. Đơn thiếu hàng trên Pancake tự thành lệnh may trong app, kèm đúng ảnh, đúng màu,
   đúng size, đúng số lượng còn thiếu.
2. Thợ bấm Xong → tồn kho Pancake tự tăng lên, không cần ai gõ phiếu nhập.
3. Thợ và chủ xưởng được nhắc hàng ngày đơn nào cần may gấp, xếp theo thời gian.
4. Chủ xưởng có một màn hình soát lại mọi phiếu nhập kho mà app đã tự đẩy sang Pancake.
5. Cả thợ lẫn chủ xưởng nhìn phát thấy ngay **tổng số cái đang cần may**.
6. Chủ xưởng có một bảng theo dõi chi tiết từng đơn thiếu — mã vận đơn, tên khách, số
   điện thoại, mẫu mã thiếu — xem được theo từng ngày, xuất được Excel và PDF.
7. App không còn bị Supabase cho ngủ sau 7 ngày.

### Không làm lần này

- Không đổi cách thợ thao tác. Không thêm bước nào cho thợ.
- Không đụng vào giá bán, khuyến mãi, vận chuyển, công nợ trên Pancake.
- Không tự huỷ hay tự sửa đơn hàng trên Pancake. App chỉ **đọc đơn** và **ghi phiếu nhập kho**.
- Không làm app cho nhiều thợ (xưởng đang 1 thợ — xem mục 10).
- Không chuyển ảnh sang Supabase Storage (giữ nguyên cách hiện tại cho ảnh tự up).

### Tuyệt đối tránh

Đây là những thứ làm hỏng niềm tin vào hệ thống, nếu xảy ra thì coi như thất bại kể cả
khi mọi thứ khác chạy đúng:

- **Nhập kho hai lần cho cùng một lần báo xong.** Tồn kho ảo cao → bán hàng không có.
- **Tạo trùng lệnh may** cho cùng một mẫu mã khi nhiều đơn Pancake cùng thiếu nó.
- **Nuốt lỗi im lặng.** Một phiếu nhập kho thất bại mà không ai biết còn tệ hơn là không
  tự động gì cả. Mọi lỗi phải hiện lên màn hình admin kèm nút xử lý.
- **Thợ bị chặn vì Pancake.** Pancake lỗi hay mạng chậm thì thợ vẫn phải bấm Xong được
  như thường; việc đẩy sang Pancake chạy ngầm phía sau.

---

## 3. Dữ liệu thật đã xác minh

Đã gọi API thật bằng key của shop ngày 27/10/2026, không phải giả định:

| Thứ          | Giá trị thật                                                                          |
| ------------ | ------------------------------------------------------------------------------------- |
| Shop ID      | `970675` — Grace's Sweet Bikini                                                       |
| Nhà cung cấp | **Chỉ có 1**: "Xưởng nhà làm", id `1842006837`                                        |
| Kho          | **Chỉ có 1**: "Khohang 81 - Grace's Sweet", id `c4f2c739-a5a9-4f36-911f-26323b6a21cd` |
| Số mẫu mã    | 4.440 (89 trang × 50)                                                                 |
| Ảnh          | 48/50 mẫu có ảnh riêng **theo từng màu**                                              |
| Tồn âm       | Shop bật `is_sell_negative_variation` — tồn có thể xuống dưới 0                       |

Vì chỉ có một kho và một nhà cung cấp, app không bao giờ phải đoán xem nhập vào kho nào
hay của xưởng nào.

**Điểm vướng đã phát hiện:** payload đơn hàng Pancake gửi sang **không kèm tên nhà cung
cấp**, chỉ có `variation_id`. Nhà cung cấp nằm ở cấp sản phẩm (`supplier_product_ids`).
Nên app phải giữ sẵn một bảng tra cứu mẫu mã, đồng bộ hằng đêm.

---

## 4. Luồng A — Pancake đẩy đơn sang app

### Cách nhận

Pancake có webhook chính thức. Bật ở _Cấu hình → Cấu hình ứng dụng → Webhook/API_,
chọn loại dữ liệu `orders`, trỏ vào `POST /api/pancake/webhook` của app. Pancake bắn
sang ngay khi đơn được tạo **hoặc sửa**.

Yêu cầu của Pancake: server phải trả `2xx` trong vòng 30 giây. Nếu thất bại, Pancake
thử lại sau 10 phút, rồi 30 phút nữa, rồi bỏ. Nếu URL sai, Pancake **tự tắt webhook**
của shop.

Nên route này phải: xác thực header bí mật → ghi payload thô vào bảng → **trả 200 ngay**
→ xử lý sau. Không xử lý đồng bộ trong lúc Pancake đang chờ.

### Cách quyết định có may hay không

Với mỗi dòng hàng trong đơn:

1. **Bỏ qua đơn đã đi**: chỉ xử lý đơn trạng thái Mới (0) và Đã xác nhận (1). Đơn đã gửi
   hàng, đã huỷ, đã hoàn thì không sinh lệnh may.
2. **Tra nhà cung cấp** trong bảng `pancake_variants`. Nếu `supplier_product_ids` không
   chứa `1842006837` → **bỏ qua, không may**. (Chủ xưởng đã chốt: chỉ may cái nào ghi rõ
   "Xưởng nhà làm".) Nếu chưa có mẫu mã này trong bảng, gọi API lấy riêng nó rồi mới quyết.
3. **Tính số cần may** — xem mục dưới.

### Cách tính số cần may (phần quan trọng nhất)

Cách ngây thơ là "đơn thiếu mấy cái thì may mấy cái". Cách đó **sai khi hai đơn cùng
thiếu một mẫu mã** — app sẽ ra hai lệnh may chồng nhau.

Thiết kế dùng một quy tắc chặt hơn, đọc được thành một câu:

> **Tổng số đang nằm trong các lệnh may chưa xong của một mẫu mã, luôn bằng đúng số mà
> Pancake đang thiếu của mẫu mã đó.**

Cụ thể, mỗi lần có việc xảy ra với mẫu mã X:

```
thiếu_hiện_tại = max(0, −remain_quantity của X tại kho Khohang 81)

đã_lo_liệu = (tổng quantity các lệnh may của X còn "chờ may")
           + (tổng quantity các phiếu nhập kho của X chưa vào được Pancake:
              pending / đang thử lại / lỗi / đã-bỏ-qua)

chênh = thiếu_hiện_tại − đã_lo_liệu

chênh > 0  → tạo lệnh may mới đúng "chênh" cái
chênh = 0  → không làm gì
chênh < 0  → đơn Pancake đã bị huỷ hoặc sửa giảm; KHÔNG tự xoá lệnh may
             (thợ có thể đã may rồi) — gắn cờ "có thể may dư" cho admin xem và tự quyết
```

**Vế `đã_lo_liệu` phải gồm cả phiếu nhập kho chưa xong — đây là chỗ bản nháp đầu bị sai.**

Lý do: khi thợ bấm Xong, lệnh may chuyển sang "xong" ngay, nhưng Pancake **vẫn còn âm**
cho tới lúc phiếu nhập kho vào được. Trong khoảng trống đó, nếu có webhook hay lượt đối
chiếu đêm chạm vào mẫu mã này thì `thiếu = 8`, `đang_có_lệnh_may = 0` → app đẻ thêm một
lệnh may 8 cái nữa. Đúng cái mục 2 gọi là thất bại tuyệt đối. Tính cả hàng đợi nhập kho
vào vế này thì khoảng trống đó biến mất.

Vì sao dùng `remain_quantity` âm: Pancake đã trừ đơn vào tồn ngay khi đơn được tạo. Mẫu
`A208-TRANG-L` hiện đang ở `−1` — nghĩa là đã bán hụt 1 cái. Con số âm đó **chính là số
còn thiếu**, đã tính gộp mọi đơn đang chờ. Dùng nó thì không bao giờ đếm trùng.

`remain_quantity` phải lấy tươi từ API ngay lúc xử lý (`GET /products/variations?variation_ids[]=…`),
không dùng số trong bảng tra cứu — số đó có thể đã cũ vài tiếng.

### Lệnh may được tạo ra trông như thế nào

| Trường              | Lấy từ đâu                                                   |
| ------------------- | ------------------------------------------------------------ |
| Sản phẩm, màu, size | `fields` của mẫu mã (Màu / Size)                             |
| Mã mẫu mã           | `display_id`, ví dụ `A208-DEN-M`                             |
| Ảnh                 | `images[0]` của mẫu mã — **lưu đường dẫn, không lưu base64** |
| Số lượng            | "chênh" tính ở trên                                          |
| Hạn may             | hôm nay + **2 ngày**                                         |
| Mức ưu tiên         | `normal` — chủ xưởng tự ghim gấp như đang làm                |
| Nguồn               | `pancake`, kèm mã đơn và tên khách để đối chiếu              |

Tạo xong → đẩy thông báo cho thợ (Web Push khi đóng app + banner/bíp/rung khi đang mở,
đúng cơ chế app đang dùng).

---

## 5. Luồng B — May xong, tự nhập kho Pancake

Thợ bấm **Xong hết** hoặc **Xong một phần** như hiện tại. Không thêm bước nào.

Ngay sau khi ghi `production_logs` thành công, app xếp một việc nhập kho vào hàng đợi,
rồi gọi `POST /shops/970675/purchases`:

```json
{
  "purchase": {
    "warehouse_id": "c4f2c739-a5a9-4f36-911f-26323b6a21cd",
    "status": 1,
    "supplier_products_id": 1842006837,
    "not_create_transaction": true,
    "auto_create_debts": false,
    "note": "Xưởng 81 tự nhập — lệnh <id> — <tên thợ>",
    "items": [
      {
        "variation_id": "…",
        "quantity": 8,
        "imported_price": 0,
        "gross_price": 0,
        "discount": 0,
        "index": 0
      }
    ]
  }
}
```

- `status: 1` = "Đã nhập hàng", tức tồn kho tăng ngay.
- `imported_price: 0` — chủ xưởng đã chọn (xem mục 10, có ghi rõ cái giá phải trả).
- `not_create_transaction` + `auto_create_debts: false` — không sinh phiếu thu chi hay
  công nợ, vì đây là hàng tự làm chứ không mua của ai.

### 5b. Đơn chủ xưởng tự tạo cũng vào kho Pancake

Chủ xưởng đã chốt: hàng may xong từ **đơn tự tạo** cũng phải tự vào kho Pancake, không
chỉ đơn do Pancake đẩy sang. Nếu không thì tồn kho sẽ lệch dần và chị lại phải nhập tay
đúng những món đó.

Để làm được, màn **Tạo đơn** thêm một bước: sau khi chọn sản phẩm / màu / size, chị chọn
**mẫu mã Pancake tương ứng**. App gợi ý sẵn bằng cách dò trong `pancake_variants` theo
tên sản phẩm + màu + size, nên phần lớn trường hợp chỉ cần bấm xác nhận.

- Chọn được mẫu mã → may xong tự vào kho, y như đơn từ Pancake.
- Để trống (hàng không có trên Pancake) → vẫn tạo đơn bình thường, chỉ là không nhập kho.
  Đơn đó hiện nhãn **KHÔNG VÀO KHO** để chị biết mà không trông chờ.

**Màn "Nhập sản lượng" bị gỡ khỏi app thợ** (chủ xưởng yêu cầu 27/10). Thanh nav của thợ
còn **2 tab: Đơn hàng · Lịch sử**. Route `/nhap-san-luong` vẫn còn nhưng chỉ chủ xưởng vào
được, nằm trong tab con của **Báo cáo**, để ghi bù khi cần.

Việc này gỡ luôn một nút thắt: trước đó `production_logs` có hai nơi ghi, và nơi thứ hai
(`nhap-san-luong`) **không gắn với đơn nào** nên không có mẫu mã để nhập kho Pancake. Bỏ
nó khỏi app thợ thì **mọi thứ thợ may xong đều gắn với một đơn**, nên đều có đường vào
kho. Sản lượng chủ xưởng tự ghi bù vẫn không vào kho — đó là ngoại lệ hiếm và có chủ ý.

### Chống nhập kho hai lần

Mỗi việc nhập kho gắn khoá duy nhất là **id của `production_logs`**. Bảng hàng đợi đặt
ràng buộc duy nhất trên khoá đó. Gọi lại bao nhiêu lần cũng chỉ ra một phiếu nhập.

### Khi Pancake lỗi

Thử lại theo ba lớp, vì trên gói miễn phí không có bộ hẹn giờ chạy theo phút:

1. **Ngay lập tức** — 3 lần trong khoảng 20 giây, ngay trong request của thợ. Phần lớn
   lỗi là chập chờn mạng, lớp này nuốt gần hết.
2. **Quét hàng đợi mỗi 5 phút** — GitHub Actions. Repo `chienho1988/xuong-81-ho-van-hue`
   là **public**, nên số phút Actions **không giới hạn** — đã kiểm tra. Lưu ý cron của
   GitHub hay trễ 5–15 phút, nên đừng hứa "đúng 5 phút".
3. **Quét lại khi có người mở app** — app vốn đã hỏi Supabase mỗi 2 giây; thấy có việc
   tồn đọng thì gọi route xả hàng đợi. Giờ làm việc thì luôn có người mở app, nên lớp
   này thực tế nhanh hơn cron.

Hết ba lớp vẫn hỏng thì việc đó ở trạng thái **Lỗi**, và:

- **Hiện đỏ** trên màn "Nhập kho Pancake" kèm lý do Pancake trả về.
- **Đẩy Web Push cho chủ xưởng ngay** — không đợi chị tự mở màn đó ra xem. Cột
  `notified_at` trong `pancake_stock_ins` để không báo lại nhiều lần.
- **Kèm vào bản nhắc 7h30 hôm sau** nếu vẫn chưa xử lý.

Hai nút trên dòng lỗi:

- **Thử lại** — gọi lại Pancake.
- **"Tôi đã tự nhập tay"** (thay cho chữ "Bỏ qua" mơ hồ ở bản nháp đầu) — hỏi xác nhận
  một lần, rồi đánh dấu `skipped`. Dòng này **vẫn được tính vào vế `đã_lo_liệu` vĩnh
  viễn**, nếu không thì mỗi lần đồng bộ app lại đẻ ra lệnh may mới cho món hàng đã may
  xong rồi. Câu xác nhận nói thẳng: _"Chọn cái này nghĩa là chị sẽ tự nhập kho trên
  Pancake. App sẽ không nhắc lại mẫu này nữa."_

Quan trọng: thợ không bao giờ bị chặn vì chuyện này. Với thợ, bấm Xong là xong.

---

## 6. Luồng C — Nhắc nhở hàng ngày

Mỗi đơn được xếp vào một trong ba nhóm, tính theo hạn may:

| Nhóm                 | Điều kiện     |
| -------------------- | ------------- |
| 🔴 Trễ hạn           | hạn < hôm nay |
| 🟠 Phải xong hôm nay | hạn = hôm nay |
| 🟢 Còn thời gian     | hạn > hôm nay |

Danh sách đơn **xếp theo mức gấp, không xếp theo ngày tạo**. Đơn được chủ xưởng ghim
luôn nằm trên cùng trong nhóm của nó.

Hai lần nhắc mỗi ngày:

- **7h30** — gửi cho cả thợ và chủ xưởng: hôm nay cần xong mấy đơn, mấy cái, có đơn nào
  đang trễ.
- **14h** — chỉ gửi **nếu còn đơn chưa xong** của hôm nay hoặc đang trễ. Không có gì thì
  im lặng, để thông báo không thành thứ bị phớt lờ.

### Bộ hẹn giờ: dùng GitHub Actions, không dùng Vercel Cron

Vercel gói Hobby **chỉ cho chạy tối đa 1 lần/ngày** và không bảo đảm đúng giờ (lệch
trong vòng 1 tiếng). Như vậy không làm được mốc 7h30 và 14h.

Repo đã nằm trên GitHub, nên dùng **GitHub Actions** làm bộ hẹn giờ — miễn phí, đặt được
giờ chính xác tới phút. Lịch viết theo giờ UTC:

| Việc                | Giờ VN | Cron UTC     |
| ------------------- | ------ | ------------ |
| Nhắc buổi sáng      | 7h30   | `30 0 * * *` |
| Nhắc buổi chiều     | 14h00  | `0 7 * * *`  |
| Đồng bộ bảng mẫu mã | 2h00   | `0 19 * * *` |
| Đánh thức Supabase  | 12h00  | `0 5 * * *`  |

Mỗi việc gọi một route của app kèm một chuỗi bí mật trong header. Không có chuỗi đó thì
route từ chối.

---

## 7. Chống Supabase ngủ sau 7 ngày

Supabase bản miễn phí cho dự án ngủ sau 7 ngày **không có request nào**.

Hai lớp, cả hai miễn phí:

1. **GitHub Actions** gọi `/api/cron/keep-alive` mỗi trưa; route này chạy một truy vấn
   nhẹ vào Supabase.
2. **Vercel Cron** gọi cùng route đó 1 lần/ngày. Hai bộ hẹn giờ độc lập — cái này chết
   còn cái kia.

Thực tế sau khi nối Pancake thì mỗi đơn mới đã là một lần chạm database, nên hiếm khi
nằm im 7 ngày. Hai cron này là để yên tâm qua Tết và các đợt nghỉ dài.

Nếu sau này dữ liệu lớn lên thì nâng Supabase Pro ($25/tháng, không bao giờ ngủ) — chưa
cần lúc này.

---

## 8. Thay đổi cơ sở dữ liệu

Theo đúng quy ước của repo: viết thành file `supabase-*.sql` ở gốc, **chủ xưởng tự dán
vào Supabase SQL Editor**. Code phải chạy được cả khi chưa chạy migration.

**Bảng mới**

- `pancake_variants` — bản sao danh mục mẫu mã để tra cứu nhanh: `variation_id` (khoá
  chính), `display_id`, `product_id`, `product_name`, `color`, `size`, `image_url`,
  `supplier_ids`, `retail_price`, `remain_quantity`, `synced_at`.
- `pancake_webhook_events` — payload thô Pancake gửi sang, để chống xử lý trùng và để
  soi lại khi có sự cố: `id`, `order_id`, `updated_at`, `payload`, `received_at`,
  `processed_at`, `error`.
- `pancake_stock_ins` — hàng đợi nhập kho: `id`, `production_log_id` (**duy nhất**),
  `variation_id`, `quantity`, `status` (`pending`/`ok`/`error`/`skipped`), `attempts`,
  `purchase_display_id`, `error_message`, `created_at`, `completed_at`.
- `cutting_logs` — sổ cắt: `id`, `order_id`, `product_id`, `quantity`,
  `created_by`, `created_at`. Tách khỏi `production_logs` (lý do ở mục 9c).

**Cột thêm vào `orders`**

`source` (`manual`/`pancake`), `pancake_order_id`, `pancake_order_display_id`,
`pancake_customer_name`, `pancake_customer_phone`, `pancake_tracking_code`,
`pancake_carrier`, `pancake_order_status`, `pancake_variation_id`, `pancake_sku`,
`image_url`, `surplus_flag`.

Thêm `cut_quantity` (số cái đã cắt, mặc định 0) — xem mục 9c.

`pancake_tracking_code` và `pancake_carrier` **để trống lúc đầu**: đơn mới chưa có mã
vận đơn, mã chỉ sinh ra khi đơn được đẩy sang đơn vị vận chuyển (đã kiểm chứng trên đơn
thật — đơn `67596` có `SPXVN06775923917A` / SPX Express, đơn mới `67619` thì trống).
Webhook `orders` bắn lại mỗi lần đơn được sửa, nên route webhook phải **cập nhật lại mã
vận đơn và trạng thái đơn cho các lệnh may đã tạo**, chứ không chỉ xử lý đơn mới.

### 8b. Sản phẩm Pancake vào bảng `products` nội bộ thế nào

Đây là chỗ bản nháp đầu bỏ sót. Schema thật bắt buộc:

- `orders.product_id` NOT NULL, khoá ngoại tới `products(id)`
- `production_logs.product_id` NOT NULL, cũng khoá ngoại tới `products(id)`

Nên **không thể tạo lệnh may từ Pancake nếu chưa có một dòng `products` tương ứng**.

Quy mô thật của shop (đã đếm qua API): **4.440 mẫu mã, ước tính ~2.087 sản phẩm**. Tạo
sẵn hết là hỏng màn Sản phẩm của chủ xưởng — đang quản tay vài chục món, bỗng thành hai
nghìn.

**Cách làm: tạo dần theo nhu cầu (lazy).**

- Chỉ khi một mẫu mã Pancake thật sự cần lên lệnh may, app mới tạo dòng `products`
  tương ứng, gắn cờ `source = 'pancake'` và lưu `pancake_product_id` để không tạo trùng.
- Danh mục: Pancake đang dùng _Áo thể thao, Quần thể thao, Pickleball, Đồ bơi_ — khác bộ
  danh mục nội bộ (_Áo, Váy, Set, Quần, Khác_). App tạo danh mục theo tên của Pancake
  nếu chưa có, giữ nguyên tên để chị nhìn là nhận ra.
- Màn **Sản phẩm** thêm một bộ lọc **Của tôi / Từ Pancake**, mặc định hiện "Của tôi".
  Danh sách chị tự làm không bị trộn lẫn.
- Nhờ mỗi sản phẩm Pancake là một `products` thật, hai màn **Lịch sử** và **Báo cáo**
  (gom theo `product_id`) vẫn chạy đúng, không phải sửa.

Cột thêm vào `products`: `source` (`manual`/`pancake`), `pancake_product_id`.

Lưu ý bẫy đã ghi trong CLAUDE.md: bảng `orders` **không có** `updated_at`, đừng ghi vào.
`products` **không có** cột `variants`.

---

## 9. Thay đổi giao diện

Giữ nguyên màu và bố cục hiện tại (xanh `#1976D2`, mobile 480px, nav dưới). Mockup đã
duyệt gồm ba màn:

**App thợ — "Đơn cần may"**

- **Dải tổng ngay đầu màn: tổng số cái đang cần may.** Đây là con số thợ hỏi đầu tiên
  mỗi sáng, nên nó phải là chữ to nhất màn hình, không phải đi đếm từng đơn.
  Dưới nó chia nhỏ: trễ hạn bao nhiêu cái / hôm nay bao nhiêu cái.
- Danh sách chia nhóm Trễ hạn / Hôm nay / Còn thời gian.
- Mỗi đơn có ảnh đúng màu lấy từ Pancake, mã mẫu mã, nhãn **TỪ PANCAKE** hoặc **TỰ TẠO**.
- **Thanh nav của thợ còn 2 tab: Đơn hàng · Lịch sử.** Màn Nhập sản lượng đã gỡ khỏi
  app thợ (xem mục 5b).
- **Hai kiểu xem, đổi bằng một cặp nút ở đầu màn**: _Theo đơn_ hoặc _Gộp theo mẫu mã_
  (xem mục 9a).
- **App thợ không hiện tên khách, số điện thoại hay mã vận đơn.** Thợ không cần, và đó
  là thông tin khách hàng — để nguyên bên admin.

**App chủ xưởng — màn "Hôm nay" (mới)**

- **Tổng số cái đang cần may** — cùng con số thợ thấy, để hai bên nói cùng một ngôn ngữ.
- Ba số phụ: Pancake đẩy sang / Đang may / Trễ hạn.
- Cảnh báo đơn trễ, có kèm mã đơn Pancake và tên khách đang chờ.
- Danh sách Pancake vừa đẩy sang, và danh sách đã xong hôm nay kèm nhãn **ĐÃ NHẬP KHO PANCAKE**.

**App chủ xưởng — màn "Bảng đơn thiếu" (mới, chi tiết)**

Đây là màn xem sâu, dựng giống bảng đơn hàng trên Pancake cho quen mắt. Mỗi dòng là một
mẫu mã thiếu của một đơn:

| Cột            | Nguồn dữ liệu                                                     |
| -------------- | ----------------------------------------------------------------- |
| Mã đơn         | `id` của đơn Pancake (vd `67617`)                                 |
| Mã vận đơn     | `partner.extend_code` — trống cho tới khi đẩy đơn đi, rồi tự điền |
| Tên khách      | `bill_full_name`                                                  |
| Số điện thoại  | `bill_phone_number` — bấm gọi được luôn                           |
| Sản phẩm thiếu | mã mẫu mã + màu + size, kèm ảnh nhỏ                               |
| Số lượng       | số cần may                                                        |
| Hạn may        | ngày                                                              |
| Trạng thái     | Chờ may / Đang may / Xong                                         |

- **Dòng nào xong thì tự tô xanh** (nền xanh nhạt `#E8F5E9`, chữ trạng thái xanh đậm
  `#2E7D32`). Tô ngay khi thợ bấm Xong, không cần tải lại trang — app đã có sẵn cơ chế
  đồng bộ realtime.
- **Chọn ngày** ở đầu màn: xem một ngày bất kỳ, hoặc một khoảng ngày. Mặc định là hôm nay.
  Mỗi ngày có dòng tổng riêng: ngày đó cần may bao nhiêu cái, đã xong bao nhiêu.
- Lọc nhanh: Tất cả / Chờ may / Đã xong.
- Hai nút **Xuất Excel** và **Xuất PDF** (xem mục 9b).

**App chủ xưởng — màn "Nhập kho Pancake" (mới)**

- Tổng tháng: bao nhiêu cái đã nhập, bao nhiêu phiếu, bao nhiêu lỗi.
- Nhật ký theo ngày, mỗi dòng ghi mẫu mã, số lượng, số phiếu nhập Pancake.
- Dòng lỗi hiện đỏ kèm lý do và nút **Thử lại** / **Bỏ qua**.

### 9a. Hai cách xem danh sách của thợ: theo đơn hoặc gộp theo mẫu mã

Chủ xưởng yêu cầu 27/10: thợ xem được **cả hai kiểu**, đổi bằng một cặp nút ở đầu màn.

**Theo đơn** — mỗi đơn một thẻ, như app đang chạy. Biết rõ cái này may cho đơn nào.

**Gộp theo mẫu mã** — tất cả đơn cùng một mẫu mã gộp thành **một thẻ duy nhất**, hiện
tổng số cái và số đơn đang gộp (ví dụ `A208 · ĐEN · M — 8 cái · gộp 2 đơn`). Hạn hiển
thị lấy theo **đơn gấp nhất** trong nhóm. Bấm vào thẻ xem được danh sách đơn bên trong.

Kiểu gộp hợp với cách xưởng làm thật: cắt và may cùng một mẫu một lượt thì nhanh hơn
chạy lắt nhắt từng đơn.

**Khi thợ báo xong ở chế độ gộp**, app chia ngược số lượng về từng đơn — không được để
"xong 8 cái" treo lơ lửng không thuộc đơn nào:

```
Thứ tự chia: đơn trễ hạn trước → rồi đơn có hạn gần nhất → rồi đơn tạo sớm hơn.
Mỗi đơn nhận cho đủ số của nó rồi mới sang đơn kế tiếp.
```

Ví dụ: gộp 8 cái gồm đơn A (5 cái, trễ) và đơn B (3 cái, hạn mai). Thợ báo xong 6 →
đơn A nhận đủ 5 và đóng, đơn B nhận 1 và còn thiếu 2.

Hệ quả về dữ liệu, phải làm đúng:

- Vẫn ghi **một `production_logs` cho mỗi đơn**, không gộp — nếu không thì Lịch sử và
  Báo cáo mất dấu đơn.
- Nhưng chỉ tạo **một phiếu nhập kho Pancake cho cả lượt báo xong đó**, vì cùng một mẫu
  mã và cùng một lần may. Khoá chống trùng của `pancake_stock_ins` vì thế đổi từ
  `production_log_id` sang một **`batch_id`** sinh ra cho mỗi lượt báo xong, và bảng
  phụ `pancake_stock_in_logs` nối `batch_id` với các `production_log_id` thuộc về nó.
  Ở chế độ "theo đơn" thì mỗi lượt chỉ có một log, nên vẫn đúng như trước.

**Mặc định là Gộp theo mẫu mã** (chủ xưởng chốt 27/10) — mở app lần đầu thấy kiểu gộp
trước. Sau đó lựa chọn của thợ lưu trong `localStorage` của máy họ, mở lại giữ nguyên.

### 9b. Xuất Excel và PDF

Xuất đúng những dòng đang hiện trên màn hình (đã lọc, đã chọn ngày) — cái chị thấy là
cái chị nhận được, không có bất ngờ.

- **Excel** — dùng SheetJS (`xlsx`), chạy ngay trên máy, không qua server. Mỗi cột một
  ô riêng để còn lọc và tính tiếp được. Tên file: `don-thieu-2026-10-27.xlsx`.
- **PDF** — dùng **pdfmake**, không dùng jsPDF.

  Lý do phải nói rõ: font mặc định của jsPDF **không có dấu tiếng Việt** — tên khách sẽ
  ra "Trõn Song V?nh Th?y". pdfmake đóng sẵn font Roboto có đủ dấu, nên chữ ra đúng.
  Đây là loại lỗi chỉ lòi ra lúc in thật, nên chốt ngay từ thiết kế.

  PDF xếp theo chiều ngang, có tiêu đề ngày và dòng tổng cuối bảng, để in ra dán xưởng
  hoặc gửi cho người khác được.

Cả hai nút chỉ có ở app chủ xưởng, vì file có số điện thoại khách.

---

### 9c. Theo dõi số đã cắt (chủ xưởng đề nghị 27/10)

Xưởng cắt tay từng cái để bổ sung hàng hàng ngày. Một đơn 5 cái có thể cắt 2 cái hôm
nay, 3 cái mai. Cắt là **việc chặn**: chưa cắt thì thợ không may được, nên con số này
phải nhìn thấy ngay chỗ quyết định may cái gì tiếp.

**Dữ liệu**

- `orders.cut_quantity INTEGER NOT NULL DEFAULT 0` — đã cắt bao nhiêu cái cho đơn này.
- Bảng mới `cutting_logs`: `id`, `order_id`, `product_id`, `quantity`, `created_by`,
  `created_at`. **Tách riêng, không dùng chung `production_logs`** — mọi báo cáo và màn
  Lịch sử đang có đều đọc `production_logs`, thêm cột `stage` vào đó thì mọi truy vấn cũ
  phải sửa, sót một chỗ là cộng đôi sản lượng.
- Đơn Pancake đẩy sang có `cut_quantity = 0`.
- Ba con số của một đơn: `quantity` (đặt) ≥ `cut_quantity` (đã cắt) ≥ số đã may
  (`quantity − remaining_quantity`).

**Giao diện — 5 chỗ**

1. **Thẻ đơn** (cả hai app): một dòng `✂️ Đã cắt 3/5 · 🧵 Đã may 1/5` kèm thanh ba
   màu — xanh là đã may xong, **cam là đã cắt đang chờ may**, xám là chưa cắt. Cam còn
   dài thì thợ còn việc; cam hết mà xám còn nhiều là thợ sắp ngồi chơi.
2. **Nút `✂️ Cắt`** trên thẻ đơn, **chỉ chủ xưởng thấy** → bảng số giống hệt bảng "Xong
   một phần" thợ đang dùng, thêm hàng nút nhanh `+1 · +2 · +5 · Cắt hết`.
3. **Chế độ "Bàn cắt"** — vào bằng nút `✂️` trên thanh tiêu đề màn Đơn hàng. Danh sách
   gọn một dòng một đơn, mỗi dòng một bàn tăng/giảm, một nút **Lưu** cho cả lượt. Dùng
   khi đứng ở bàn cắt làm nhiều đơn liền tay. Đơn gấp xếp đầu, đơn cắt đủ tô xanh.
   **Không thêm tab mới ở thanh dưới** — thanh dưới đã đủ 5 tab.
4. **Màn Hôm nay (admin)**: thêm khối cam **"Việc cắt của anh"** đặt **trên** khối xanh
   việc may — tổng số cái chưa cắt, kèm câu cảnh báo "thợ còn N cái đã cắt để may", và
   nút mở bàn cắt. Dưới có danh sách anh đã cắt hôm nay và tổng.
5. **App thợ**: chỉ xem, không ghi được số cắt. Thêm nhãn **MAY ĐƯỢC N CÁI**
   (= `cut_quantity` − đã may). Khi thợ ghi số may **nhiều hơn** số đã cắt thì hiện
   nhắc "Đơn này mới cắt 3 cái — anh chủ chưa ghi, hoặc chị đếm nhầm?" với hai lựa chọn
   _Để xem lại_ / _Vẫn ghi_. **Nhắc, không chặn** — chủ xưởng quên ghi số cắt thì thợ
   vẫn phải làm được việc.

**Báo cáo**: tab Tháng thêm dòng **Đã cắt** cạnh **Đã may**; màn Lịch sử phân biệt
`✂️` với `🧵`.

**Quy tắc**

- `cut_quantity` không bao giờ tự giảm. Chủ xưởng sửa sai bằng dấu `−` trong bảng số,
  nhưng **không giảm xuống thấp hơn số đã may** (hàng đã may thì chắc chắn đã cắt).
- Nếu Pancake sửa đơn giảm xuống dưới số đã cắt, đánh dấu **cắt dư** cho chủ xưởng tự
  quyết, giống cách xử lý `surplus_flag` ở mục 4 — không tự xoá.
- Việc cắt **thuần nội bộ**, không dính gì tới kho Pancake. Chỉ lúc may xong mới nhập
  kho (mục 5).

**Nút `+` tạo đơn**: giữ nguyên ở góc dưới phải màn Đơn hàng, chỉ chủ xưởng thấy. Bản
mockup đầu vẽ sót nút này, bản thiết kế không đổi gì ở đây.

## 10. Những gì chủ xưởng đã chốt

| Quyết định          | Đã chọn                                                              |
| ------------------- | -------------------------------------------------------------------- |
| Lọc đơn nào để may  | **Chỉ mẫu mã ghi rõ nhà cung cấp "Xưởng nhà làm"**                   |
| Số lượng may        | Đúng số còn thiếu                                                    |
| Nhập kho Pancake    | **Tự động ngay** khi thợ bấm Xong, không cần duyệt                   |
| Giá nhập trên phiếu | **0 đồng**                                                           |
| Hạn may mặc định    | **2 ngày**                                                           |
| Giờ nhắc            | **7h30 và 14h**                                                      |
| Số thợ              | **1 thợ**, giữ nguyên một mã PIN                                     |
| Tổng số cần may     | Hiện trên **cả hai app**, chữ to ở đầu màn                           |
| Bảng chi tiết       | Chỉ app admin: mã vận đơn, tên khách, SĐT, mẫu mã thiếu              |
| Xem theo ngày       | Chỉ app admin, chọn được ngày bất kỳ                                 |
| Dòng đã xong        | **Tự tô xanh** ngay khi thợ bấm Xong                                 |
| Xuất file           | **Excel và PDF**, chỉ app admin                                      |
| Đơn tự tạo          | **Cũng vào kho Pancake** — chị chọn mẫu mã lúc tạo đơn               |
| Màn Nhập sản lượng  | Giữ nguyên, không vào kho, không thêm bước cho thợ                   |
| Xong một phần       | **Mỗi lần một phiếu nhập** riêng trên Pancake                        |
| Chạy thử            | **Được phép** tạo 1 phiếu nhập thật 1 cái rồi huỷ ngay, có báo trước |
| Màn Nhập SL của thợ | **Gỡ bỏ** — nav thợ còn 2 tab; chỉ admin vào được, trong Báo cáo     |
| Danh sách của thợ   | Xem được **cả 2 kiểu**: theo đơn, hoặc gộp tổng theo mẫu mã          |
| Kiểu mặc định       | **Gộp theo mẫu mã**                                                  |
| Ghi số đã cắt       | **Chỉ chủ xưởng ghi**, thợ chỉ xem (đề xuất 27/10)                   |

### Một điều cần nói rõ về giá nhập 0 đồng

Chủ xưởng đã chọn và tôi làm đúng vậy. Nhưng để biết mà quyết, không phải để cản:

Mỗi phiếu nhập 0 đồng sẽ **kéo "giá nhập trung bình" của mẫu mã đó xuống dần**. Báo cáo
lãi lỗ trên Pancake vì thế sẽ **báo lãi cao hơn thực tế**, vì chi phí công may không được
tính vào đâu cả.

Nếu sau này muốn số liệu đúng hơn, đây là chỗ đổi một dòng: thay `imported_price: 0` bằng
giá vốn trung bình đang có, hoặc bằng một bảng giá công may. Đã thiết kế để đổi dễ.

---

## 11. Những gì tôi tự quyết

Các lựa chọn này không ai hỏi tôi, tôi chọn theo thói quen nghề — chủ xưởng đọc và bác
được bất cứ cái nào:

- **Dùng GitHub Actions làm bộ hẹn giờ** thay Vercel Cron, vì gói Hobby không chạy được
  2 lần/ngày.
- **Lưu ảnh Pancake dạng đường dẫn**, không tải về base64 như ảnh tự up. Nhẹ database,
  và ảnh luôn khớp với Pancake.
- **Quy tắc "tổng lệnh may = số đang thiếu"** thay vì tạo lệnh theo từng đơn, để không
  tạo trùng khi nhiều đơn cùng thiếu một mẫu mã.
- **Không tự xoá lệnh may khi đơn Pancake bị huỷ** — chỉ gắn cờ cho admin xem, vì thợ có
  thể đã may rồi.
- **Buổi chiều im lặng nếu không còn đơn** — để thông báo không bị nhờn.
- **Đồng bộ danh mục lúc 2h sáng**, cộng với lấy lẻ ngay khi gặp mẫu mã lạ.
- **Dùng pdfmake thay jsPDF** để xuất PDF, vì jsPDF không in được dấu tiếng Việt.
- **Giấu tên khách / số điện thoại / mã vận đơn khỏi app thợ.** Thợ chỉ cần biết may cái
  gì, mấy cái, bao giờ xong. Nếu chị muốn thợ thấy thì nói, đổi dễ.
- **Xuất file lấy đúng dòng đang hiện trên màn**, không xuất toàn bộ lịch sử.
- **Tạo sản phẩm nội bộ theo nhu cầu**, không đổ sẵn 2.087 sản phẩm Pancake vào app
  (mục 8b). Màn Sản phẩm thêm bộ lọc Của tôi / Từ Pancake.
- **Thanh nav của chủ xưởng giữ 5 tab**: Hôm nay · Đơn hàng · Đơn thiếu · Sản phẩm ·
  Báo cáo. _Nhập SL_, _Lịch sử_ và _Nhập kho Pancake_ thành tab con bên trong **Báo cáo**
  — không tab nào bị mất, chỉ đổi chỗ. (Mockup vẽ thiếu hai tab này; đây mới là ý định.)
- **Đổi nút "Bỏ qua" thành "Tôi đã tự nhập tay"** kèm câu xác nhận, vì chữ cũ không nói
  được hậu quả.
- **Có công tắc `PANCAKE_DRY_RUN`** — bật lên thì app làm mọi thứ trừ việc gọi thật sang
  Pancake, chỉ ghi lại "nếu chạy thật sẽ gửi cái này". Dùng để chạy thử và để tắt khẩn
  cấp mà không phải deploy lại.
- **Đơn đang có lúc chạy migration coi như đã cắt đủ** (`cut_quantity = quantity`).
  Nếu để 0 thì sáng hôm sau màn Hôm nay báo cả trăm cái "chưa cắt" trong khi hàng đã
  nằm trên bàn thợ — số sai còn tệ hơn không có số.
- **Ghi số cắt là việc của chủ xưởng, thợ chỉ xem.** Vì chính chủ xưởng cắt tay. Muốn
  cho thợ ghi thì nói, bật thêm quyền là xong.
- **Nhắc chứ không chặn** khi thợ ghi may nhiều hơn số đã cắt (mục 9c).

---

## 12. Rủi ro và cách xử lý

| Rủi ro                                            | Xử lý                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pancake tự tắt webhook khi URL hỏng               | Mỗi lần đồng bộ đêm, đối chiếu lại đơn 24h qua qua API; đơn nào lọt thì bù. Webhook không phải đường duy nhất.                      |
| Webhook bắn trùng (Pancake có retry)              | Chống trùng theo `order_id` + `updated_at` trong `pancake_webhook_events`.                                                          |
| Hai đơn cùng thiếu một mẫu mã                     | Quy tắc tổng ở mục 4 đã xử lý.                                                                                                      |
| Nhập kho hai lần                                  | Khoá duy nhất trên `production_log_id`.                                                                                             |
| API key lộ                                        | Key chỉ nằm ở biến môi trường server (`PANCAKE_API_KEY`, **không** có tiền tố `NEXT_PUBLIC_`). Không bao giờ gửi xuống trình duyệt. |
| App hiện cho ghi tự do bằng anon key (RLS mở hết) | Không làm tệ thêm, nhưng route nhập kho phải tự kiểm tra `production_log` có thật trước khi gọi Pancake, để không ai gọi khống.     |
| Giờ GitHub Actions lệch vài phút                  | Chấp nhận được với việc nhắc nhở.                                                                                                   |

---

## 13. Phần để lại cho người làm

- Cách chia file: route mới nên nằm ở `src/app/api/pancake/*` và `src/app/api/cron/*`;
  phần gọi Pancake gom vào một module dùng chung ở `src/lib/`.
- `src/app/don-hang/page.tsx` là file lớn nhất và chứa cả view admin lẫn worker — sửa
  thận trọng, giữ nguyên style/UX hiện có.
- **Chủ xưởng đã cho phép** tạo **một** phiếu nhập thật đúng **1 cái** trên shop đang
  kinh doanh để kiểm chứng, với điều kiện: báo trước khi chạy, báo mã phiếu, huỷ ngay
  sau đó, và đối chiếu tồn kho trước/sau để chắc chắn đã trả lại đúng. Không mở rộng
  ra ngoài phạm vi này.
- Cần kiểm chứng khi làm: trường `supplier_products_id` trong phiếu nhập kho — tài liệu
  Pancake có ví dụ không nhất quán với dữ liệu thật của shop. Chạy một phiếu nhập thử
  **1 cái** rồi xoá, trước khi bật thật.
- Cần đo khi làm: đồng bộ 89 trang mẫu mã mất bao lâu, có vượt giới hạn thời gian của
  hàm trên Vercel không. Nếu vượt thì chia nhiều lượt.
- Thư viện mới cần thêm: `xlsx` (xuất Excel) và `pdfmake` (xuất PDF). Đây là hai gói
  duy nhất được thêm vào dự án; mọi thứ khác dùng cái đã có.
- Theo quy trình repo: `npm run build` phải pass, test E2E bằng Playwright với dữ liệu
  thật, rồi `git push origin main:master`.

---

## 13b. Đã kiểm chứng sau vòng soát độc lập

Một người đọc độc lập đã soi bản nháp đầu và nêu 10 chỗ phải đoán. Dưới đây là những
chỗ đã tự kiểm chứng được bằng dữ liệu thật, để người làm khỏi tra lại:

| Nghi vấn                                               | Đã kiểm chứng                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pancake có cho đặt header bí mật cho webhook không?    | **Có.** Tài liệu webhook của Pancake liệt kê rõ ô _Headers_ — "headers gửi kèm mọi request, ví dụ một chuỗi bí mật để server kiểm tra người gửi". Không phải nhét token vào query string.                                                                                      |
| Ảnh Pancake có hotlink được từ domain Vercel không?    | **Được.** Gọi thử `content.pancake.vn`: trả `200`, `access-control-allow-origin: *`, không chặn Referer. Nhưng header là `cache-control: max-age=0` nên ảnh không được cache — cho qua `next/image` (khai báo `remotePatterns` trong `next.config.js`) để Vercel tự cache lại. |
| GitHub Actions có đủ quota chạy cron 5 phút/lần không? | **Đủ.** Repo `chienho1988/xuong-81-ho-van-hue` là **public** → số phút Actions không giới hạn. (Nếu repo chuyển sang private thì quota còn 2.000 phút/tháng và lịch 5 phút sẽ vượt — lúc đó phải đổi.)                                                                         |
| Phiếu nhập kho thử có huỷ được không?                  | **Có.** Tồn tại `PUT /shops/{SHOP_ID}/purchases/{PURCHASE_ID}`, và danh sách trạng thái phiếu nhập có giá trị `2` = _Canceled_. Nên phiếu thử dựng lên rồi chuyển về trạng thái huỷ được. **Vẫn phải tự xác nhận tồn kho có trả lại đúng không** trước khi tin.                |
| Quy mô danh mục                                        | 4.440 mẫu mã; ước tính ~2.087 sản phẩm. Danh mục Pancake: Áo thể thao, Quần thể thao, Pickleball, Đồ bơi.                                                                                                                                                                      |
| Mã vận đơn có sẵn lúc đơn mới không?                   | **Không.** Đơn `67619` (mới) trống; đơn `67596` (đã gửi) có `SPXVN06775923917A` / SPX Express. Xem mục 8.                                                                                                                                                                      |

Hai lỗi thật mà vòng soát bắt được, đã sửa trong tài liệu này: công thức tính số cần may
bỏ sót hàng đợi nhập kho (mục 4), và thiếu đường ánh xạ sản phẩm Pancake sang bảng
`products` nội bộ (mục 8b).

---

## 14. Đề xuất cho sau này (không làm lần này)

Ghi lại để khỏi quên, chủ xưởng tự quyết khi nào làm:

1. **Báo ngược trạng thái lên Pancake** — gắn thẻ "Xưởng đang may, dự kiến xong 29/10"
   vào đơn, để người trả lời tin nhắn biết mà báo khách. Đây là cái tôi thấy đáng giá
   nhất trong nhóm này.
2. **Gợi ý may dự phòng** — API có sẵn `selling_avg` (tốc độ bán). Mẫu nào bán nhanh mà
   tồn thấp thì gợi ý may trước, đừng đợi tới lúc âm.
3. **Ảnh thành phẩm** — thợ chụp một tấm khi báo xong, chủ xưởng soát từ xa.
4. **Quét mã vạch** — dữ liệu đã có sẵn mã vạch (`595-1`…), quét để tra nhanh.
5. **Năng suất theo thợ** — khi nào xưởng thêm người.
