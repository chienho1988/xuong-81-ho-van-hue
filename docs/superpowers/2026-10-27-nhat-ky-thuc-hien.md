# Nhật ký thực hiện — nối app Xưởng 81 với Pancake

Chép lại từ sổ theo dõi lúc làm, để giữ lại mọi quyết định và mọi lượt kiểm chứng.
Ai làm tiếp dự án này nên đọc phần `Ruling:` — đó là những chỗ đã cân nhắc rồi,
đừng làm lại từ đầu.

---

# SDD ledger — plan: docs/superpowers/plans/2026-10-27-ket-noi-pancake.md

Spec: docs/superpowers/specs/2026-10-27-ket-noi-pancake-design.md (đã đọc)
Nhánh: main, trong chính checkout này, KHÔNG dùng worktree.

Setup: Ruling: chạy thẳng trên nhánh `main` của checkout hiện tại thay vì tạo
worktree — worktree sẽ bỏ lại ~5.000 dòng việc dở chưa commit từ các phiên trước,
và không có `.env.local` (gitignored) mà gần như mọi bước kiểm chứng của plan đều
cần (Supabase + Pancake thật). Chủ xưởng đã duyệt plan mà các bước commit của nó
commit vào repo này, và không push cho tới khi chủ xưởng đồng ý (Task 16 Step 8).
Cost if wrong: các commit mới trộn lẫn với việc dở trước đó trong cùng một nhánh;
gỡ ra phải lọc theo tên file.

## Pre-flight: đối chiếu Interfaces giữa các task

| Produces | Consumes | Kết quả |
| --- | --- | --- |
| T1 `tinhSoCanMay` | T7 | khớp |
| T2 `chiaNguocSoLuong` | T3, T10 | khớp |
| T3 `gomTheoMauMa` | T10 | khớp |
| T3 `tests/unit/_donMau.ts` | T12, T15 | khớp |
| T4 cột/bảng mới | T7, T8, T9, T11, T12, T13, T14 | khớp; khoá chống trùng là `batch_id` (spec 9a) chứ không phải `production_log_id` (spec 5) — 9a là bản sau, theo 9a |
| T5 `taoPhieuNhapKho`, `layMauMa`, `layTonKhoTuoi` | T7, T8 | khớp |
| T8 `xepHangNhapKho` | T10 | khớp |
| T9 `tongChuaCat`, `soMayDuoc` | T11 | khớp |
| T15 `xepNhomHan` | T10 Step 1 | XUNG ĐỘT — T10 chạy trước T15 |

Pre-flight: Ruling: `xepNhomHan` viết ở Task 10 trong `src/lib/nhacNho.ts`, Task 15
dùng lại thay vì viết mới. Plan đã lường trước ở Task 10 Step 1. Cost if wrong:
không có — cùng một file, cùng một chữ ký.

Pre-flight: Ruling: `Order` và `Product` trong `src/lib/mockData.ts` phải thêm các
trường mới (`cut_quantity`, `source`, `pancake_*`, `image_url`, `surplus_flag`,
`pancake_product_id`) ở **Task 3** — task đầu tiên đụng tới `pancake_variation_id`
— chứ không phải Task 7. Mọi trường mới để **optional** để code chạy được cả khi
chưa chạy migration (Global Constraint). Cost if wrong: Task 3 không biên dịch được,
phát hiện ngay ở `npm run build`.
Task 1: complete (commits 99f6309..09194b7, tests: npm test → ℹ duration_ms 127.8457)
Task 2: complete (commits 09194b7..0334ff2, tests: npm test → ℹ duration_ms 112.5047)

Task 3: Ruling: trong `src/`, import **kiểu** phải viết KHÔNG đuôi (`./mockData`)
còn test trong `tests/` import **giá trị** thì PHẢI có đuôi `.ts`. Lý do: Next không
chấp nhận đuôi `.ts` khi chưa bật allowImportingTsExtensions, còn Node cần đuôi để
giải đường dẫn — nhưng Node xoá hẳn import kiểu nên không phải giải. Hệ quả: module
thuần dùng cho test **không được import giá trị** từ module `src` khác.
Cost if wrong: `npm run build` đỏ ngay, phát hiện lập tức.

Task 3: Ruling: không duyệt `Map` bằng `for...of` trong `src/` — tsconfig của dự án
target `es5`, cần `downlevelIteration` mới chạy được. Dùng `.forEach()`.
Cost if wrong: `npm run build` đỏ ngay.
Task 3: complete (commits 0334ff2..ed41e04, tests: npm test → ℹ duration_ms 116.2477)

Task 4: CHƯA XONG — Step 1-3 xong (supabase-pancake.sql + scripts/kiem-tra-migration.mjs,
checker báo thiếu đúng 11 thứ, commit 1e0...). Step 4-5 PHẢI do chủ xưởng dán SQL vào
Supabase SQL Editor: máy này không có Supabase CLI, không có mật khẩu DB, không có
service_role key nên anon key không chạy được DDL. Chuyển sang Task 5 trong lúc chờ.

Task 5: Ruling: bật `allowImportingTsExtensions: true` trong tsconfig (hợp lệ vì dự
án đã `noEmit: true`). Thay cho ruling ở Task 3: giờ import giá trị trong `src/`
viết đuôi `.ts` được, Next build vẫn xanh, và Node chạy test import thẳng được mọi
module `src`. Đã xác nhận bằng `npm run build` ✓ Compiled successfully.
Cost if wrong: build đỏ ngay ở lần chạy kế tiếp.

Task 5: Hình dạng API thật đã xác minh (khỏi tra lại): mẫu mã có `id`, `display_id`
("A208-DEN-M"), `product_id` (UUID), `product.name`, `product.categories[0].name`,
`product.supplier_product_ids` (SỐ, phải đổi sang chuỗi), `fields` [{name:"Màu"|"Size",
value}], `images[0]`, `retail_price`, và tồn theo kho ở `variations_warehouses[]` lọc
theo `warehouse_id` — KHÔNG dùng `remain_quantity` cấp trên vì đó là tồn gộp mọi kho.
Lọc theo id bằng `variation_ids[]=` chạy đúng. Toàn shop 4.440 mẫu mã.
Task 5: complete (commits 707b60a..ccbe7e9, tests: npm test → ℹ duration_ms 131.268)

Task 4: Lỗi thật khi chủ xưởng chạy SQL: `format('CREATE POLICY %L ...')` sinh ra tên
policy bọc nháy đơn → 42601 syntax error. Sửa thành `%I` (định danh). Nhân tiện đổi 3
khoá chính mới từ UUID sang TEXT + `gen_random_uuid()::text` cho khớp phần schema cũ
(orders.id, production_logs.id đều TEXT). Chờ chủ xưởng chạy lại.
Task 4: complete (commits ed41e04..0f7dce1, tests: npm test → ℹ duration_ms 132.4162)
Task 6: complete (commits 0f7dce1..63e95ef, tests: npm test → ℹ duration_ms 134.3127)

=== DỪNG 27/10/2026 vì hết hạn mức dùng ===
Đã xong: Task 1, 2, 3, 4, 5, 6. Còn lại: Task 7 → 16.
Tiếp tục bằng: task-start plan 7 (BASE = 63e95ef). Migration đã chạy trên Supabase,
.env.local đã có PANCAKE_API_KEY / PANCAKE_WEBHOOK_SECRET / CRON_SECRET /
PANCAKE_DRY_RUN=1. Server thử nghiệm port 3100 đã tắt. Chưa push gì lên GitHub.
Dữ liệu thật còn lại trong bảng: 1 dòng pancake_webhook_events của đơn 67623 (đơn
thật, giữ lại để Task 7 dùng thử).

Task 7: Ruling: `orders.created_by` là KHOÁ NGOẠI tới `users(id)` chứ không phải tên
tự do — plan ghi `created_by: "Pancake"` nên insert đổ (orders_created_by_fkey). Đổi
thành id của chủ xưởng (tra `users` role='admin', fallback 'u1'). KHÔNG tạo dòng
`users` tên Pancake: mỗi dòng users là một lối đăng nhập bằng PIN, thêm một dòng là
mở thêm một cửa. Chỗ phân biệt nguồn vẫn là cột `source`.
Cost if wrong: lệnh may từ Pancake hiện tên chủ xưởng ở ô "người tạo"; đổi lại dễ.

Task 7: Ruling: vế `dangChoMay` đếm `remaining_quantity` chứ không phải `quantity`
như chữ trong spec mục 4. Đơn 5 cái đã may 2 (phiếu nhập kho đã vào Pancake, tồn đã
tăng 2) mà vẫn đếm 5 thì chênh ra âm → báo "may dư" giả. Đếm phần còn lại mới khớp
với tồn tươi. Cost if wrong: báo may dư nhầm cho đơn đang may dở.

Task 7: Đã chứng minh trên dữ liệu thật (đơn 67623, khách Thiên Kim): lần xử lý đầu
tạo đúng 2 lệnh may Q93-denL 5 cái + Q93-beoL 1 cái, hạn 29/10; ÉP xử lý lại chính
event đó thì taoMoi=0 — quy tắc chống trùng chạy đúng. Đã xoá sạch 2 lệnh may, 1 sản
phẩm và 1 danh mục test; orders về lại 53 dòng.
Task 7: complete (commits 63e95ef..4974dca, tests: npm test → ℹ duration_ms 145.4013)

Task 8: Ruling: `supabaseServer` dựng LƯỜI qua Proxy thay vì `createClient` lúc
import. Module nghiệp vụ nào import nó cũng phải chạy được trong bộ test của Node,
nơi không có biến môi trường của Next — `createClient(undefined)` ném ngay lúc import.
Cost if wrong: test đỏ ngay ở lần import đầu.

Task 8: Ruling: trong `src/lib/`, import dùng đường dẫn tương đối có đuôi `.ts`, KHÔNG
dùng alias `@/` — Node không giải được `@/`. Alias chỉ dùng trong `src/app/` (route và
page) vì chỗ đó chỉ Next biên dịch. Cost if wrong: test đỏ ngay.

Task 8: Route `/api/pancake/nhap-kho` KHÔNG chặn bằng mã bí mật (trình duyệt thợ gọi
thẳng) mà tự tra `production_logs` và lấy số lượng từ sổ sản lượng, bỏ qua con số
trình duyệt gửi lên. Đã thử: gọi với production_log_id bịa → 400 "khong co that".
Đã thử: gọi 2 lần cùng batch_id → đúng 1 dòng, không tạo phiếu nhập thứ hai.
Dữ liệu test đã xoá sạch.
Task 8: complete (commits 4974dca..d4908e5, tests: npm test → ℹ duration_ms 181.587)

Task 9: Đã kiểm trên trình duyệt thật (port 3100, đơn test o_TEST_cat 5 cái):
thẻ đơn hiện "✂️ Chưa cắt 0/5 · 🧵 Đã may 0/5"; bấm ✂️ Cắt → bảng số có +1/+2/+5/
"Cắt hết (5)" và dòng "Sau khi lưu: đã cắt 2/5"; lưu xong thẻ đổi thành "Đã cắt 2/5",
DB có cut_quantity=2 và 1 dòng cutting_logs; chế độ Bàn cắt hiện đúng banner cam, một
dòng một đơn, nút "Lưu 0 cái đã cắt"; bên thợ hiện nhãn "MAY ĐƯỢC 2 CÁI", không có nút
Cắt, và khi ghi may 4 > cắt 2 thì hiện đúng câu nhắc với hai nút "Để xem lại" /
"Vẫn ghi 4" — nhắc chứ không chặn. Đã xoá sạch đơn test và sổ cắt test.
Task 9: complete (commits d4908e5..7d11aad, tests: npm test → ℹ duration_ms 195.305)

Task 10: Ruling: `xepNhomHan` viết ở Task 10 trong `src/lib/nhacNho.ts` kèm test riêng
(TDD đúng luật, không viết code sản xuất trước test), Task 15 chỉ thêm `dungLoiNhac`.
Cost if wrong: không có.

Task 10: Đã kiểm trên trình duyệt với 2 đơn test cùng mẫu mã (5 cái trễ 25/10 + 3 cái
hạn 28/10): app thợ mở lên MẶC ĐỊNH ở kiểu Gộp, dải tổng hiện "8 cái", thẻ nhóm hiện
"gộp 2 đơn · Có đơn trễ · Hạn gấp nhất 2026-10-25"; bảng báo xong 6 cái xem trước đúng
"5 cái → đóng đơn, 1 cái → còn 2". Sau khi lưu: đơn trễ remaining 0 status done, đơn
kia còn 2; ĐÚNG 2 dòng production_logs (5 và 1); ĐÚNG 1 dòng pancake_stock_ins
quantity 6; bảng nối có 2 production_log_id cho cùng batch. Thanh nav của thợ còn 2
tab. Đã xoá sạch dữ liệu test.
Task 10: complete (commits 7d11aad..90f4cbf, tests: npm test → ℹ duration_ms 198.8926)

Task 11: Đã kiểm trên trình duyệt: /hom-nay mở đúng với vai chủ xưởng, khối cam
"Việc cắt của anh" nằm TRÊN khối xanh "Việc may của thợ", các con số khớp với
/don-hang (0 đơn chờ nên cả hai cùng 0). Thanh dưới của chủ xưởng giờ là 5 tab:
Hôm nay · Đơn hàng · Đơn thiếu · Sản phẩm · Báo cáo; của thợ là Đơn hàng · Lịch sử.
Chống chưa-migration: đã xác nhận Supabase trả `{data:null,error}` chứ không ném khi
bảng hoặc cột không tồn tại, và mọi truy vấn cột/bảng mới trong màn này đều có nhánh
lỗi riêng (cờ `coCotMoi` ẩn hẳn phần cắt).

Task 11: Ruling: tab "Đơn thiếu" đã thêm vào thanh dưới ở task này dù trang
/don-thieu tới Task 12 mới có. Trong một phiên làm liền thì khoảng hở này không ai
thấy. Cost if wrong: bấm vào tab đó trong lúc chưa xong Task 12 sẽ ra 404.
Task 11: complete (commits 90f4cbf..740ae7b, tests: npm test → ℹ duration_ms 200.5584)

Task 12: Ruling: khai báo kiểu cho pdfmake viết tay ở `src/types/pdfmake.d.ts` thay vì
cài `@types/pdfmake` — Global Constraint chỉ cho thêm đúng hai gói. Theo đúng khuôn
`src/types/web-push.d.ts` đã có sẵn. Cost if wrong: không có kiểu cho pdfmake, nhưng
chỗ gọi đã ép `any` có chủ đích.

Task 12: Ruling: tsconfig target es5 không cho cờ regex `u`, nên tên file PDF lấy ngày
bằng một regex đơn giản thay vì lọc ký tự Unicode. Cost if wrong: tên file kém đẹp.

Task 12: Ruling: pdfmake 0.3 nạp font bằng `addVirtualFileSystem(vfs)` chứ không phải
gán `.vfs` như 0.2 (đã soi build/vfs_fonts.js: `module.exports = vfs` phẳng). Code
nhận cả hai API để nâng gói sau không vỡ.

Task 12: ĐÃ kiểm — bảng hiện đúng trên trình duyệt với 2 dòng test (mã đơn 67623, mã
vận đơn SPXVN..., tên khách có dấu, số điện thoại bấm gọi được), dòng đã xong TỰ TÔ
XANH. Excel xuất thật và đọc lại được: sheet "Đơn thiếu", tiêu đề và dữ liệu giữ
nguyên dấu tiếng Việt, mã vận đơn trống chứ không in chữ null, số lượng là SỐ.
Font Roboto của pdfmake đã kiểm bằng fontkit: KHÔNG thiếu glyph nào trong
"Trần Song Vĩnh Thụy — Đơn thiếu ngày 27/10 ưở ặ ộ Ổ" (1.326 glyph).
CHƯA kiểm: bấm thật hai nút xuất trong trình duyệt (việc đó tải file về máy, cần chủ
xưởng đồng ý). Đường dẫn code đã build sạch và dữ liệu đã kiểm tách riêng.
Task 12: complete (commits 740ae7bd..0b88eb6, tests: npm test → ℹ duration_ms 208.0193)

Task 13: Ruling: hai tab con "Nhập SL" và "Lịch sử" trong Báo cáo điều hướng sang
route sẵn có (/nhap-san-luong, /lich-su) thay vì nhúng lại nội dung — giữ nguyên hai
màn đang chạy tốt, không chép code. Cost if wrong: bấm vào là rời màn Báo cáo.

Task 13: Ruling: nút "Tôi đã tự nhập tay" cập nhật thẳng Supabase từ trình duyệt,
không qua route server. Mục 12 của spec chỉ bắt route NHẬP KHO phải tự kiểm chứng vì
nó gọi sang Pancake; đánh dấu skipped là ghi nội bộ, cùng kiểu với mọi thao tác khác
của app. Cost if wrong: ai vào được app cũng đánh dấu skipped được — nhưng họ vốn đã
sửa được đơn hàng.

Task 13: LỖI THẬT bắt được khi kiểm: dòng sổ cắt không hiện trong Lịch sử vì bộ lọc
ngày của màn đó đọc cột `log_date`, mà `cutting_logs` không có cột ấy. Sửa: suy
`log_date` từ `created_at` lúc trộn hai nguồn. Sau khi sửa, Lịch sử hiện
"08:30 ✂️ Khăn / Phụ kiện 7" và dòng tổng "🧵 Đã may: 0 cái · ✂️ Đã cắt: 7 cái".

Task 13: Đã kiểm trên trình duyệt: Báo cáo có 4 tab con (Tháng · Nhập kho Pancake ·
Nhập SL · Lịch sử); tab Tháng hiện "🧵 Đã may 0 cái" cạnh "✂️ Đã cắt 7 cái"; tab Nhập
kho Pancake hiện đúng "Lỗi chưa xử lý 1" và dòng lỗi nền đỏ kèm lý do Pancake trả về
với hai nút "Thử lại" / "Tôi đã tự nhập tay"; câu lệnh đánh dấu skipped chạy đúng.
Đã xoá sạch dữ liệu test.
Task 13: complete (commits 0b88eb66..79e755b, tests: npm test → ℹ duration_ms 198.0003)

Task 14: Đã kiểm — truy vấn gợi ý mẫu mã (ilike tên + đúng màu + đúng size) trả về
đúng A207-DEN-L cho (A207, ĐEN, L). Thẻ đơn của chủ xưởng hiện nhãn nguồn TỪ PANCAKE /
TỰ TẠO, và đơn không gắn mẫu mã hiện thêm nhãn cam KHÔNG VÀO KHO. Màn Sản phẩm có bộ
lọc Của tôi / Từ Pancake, mặc định Của tôi. Đã xoá 2 đơn test.

Task 14: Lưu ý môi trường (không phải lỗi code): `npm run build` trong lúc `next start`
đang chạy làm trình duyệt báo ChunkLoadError vì HTML cũ trỏ tới chunk đã bị thay. Phải
tắt server rồi khởi động lại sau mỗi lần build.
Task 14: complete (commits 79e755b6..593d6e8, tests: npm test → ℹ duration_ms 204.7159)

Task 15: ĐO ĐƯỢC (việc spec mục 13 dặn phải đo): đồng bộ 6 trang mẫu mã = 2,6 giây,
nên cả 89 trang ~39 giây — vẫn chia 6 trang/lượt cho chắc dưới 60 giây của hàm Vercel,
workflow lặp theo `trangKeTiep`. Đối chiếu đơn 24h = 28,5 giây cho 50 đơn.

Task 15: Ruling: tách phần đối chiếu đơn 24h ra route riêng /api/cron/doi-chieu-don.
Gộp chung với đồng bộ mẫu mã thì một lượt mất 46 giây, sát trần 60 giây của Vercel và
không chia nhỏ được. Tách ra thì mỗi route tự chia lượt được. Spec mục 12 chỉ nói đối
chiếu "mỗi lần đồng bộ đêm" — workflow vẫn gọi hai việc này liền nhau lúc 2h sáng.
Cost if wrong: thêm một route phải nhớ gọi; workflow đã gọi sẵn.

Task 15: Ruling: ghi 50 đơn đối chiếu bằng MỘT upsert gộp thay vì 50 upsert lẻ — 50
lượt lẻ chính là chỗ ngốn ~30 giây. Cost if wrong: một đơn hỏng làm hỏng cả lượt ghi;
chấp nhận được vì lượt sau chạy lại.

Task 15: Ruling: route keep-alive nhận thêm user-agent của Vercel Cron, vì Vercel Cron
không đặt được header tuỳ ý. Đây là lớp dự phòng thứ hai (mục 7), lớp chính vẫn là
GitHub Actions có mã bí mật. Cost if wrong: ai giả user-agent cũng gọi được một truy
vấn đếm đơn — không lộ gì.

Task 15: Đã kiểm bằng curl: thiếu mã bí mật → 401; nhắc sáng/chiều trả imLang đúng vì
không còn đơn chờ may; keep-alive trả soDon 53. Chạy thật route đối chiếu: nạp 50 đơn
Pancake 24h qua, sinh ra 17 lệnh may thật đúng SKU (Q93-denL 5 cái, Q93-denM 7 cái,
V38-LOANG-M 4 cái...), tạo 5 sản phẩm nội bộ mới và lưu 327 mẫu mã.
ĐÃ DỌN: xoá 17 lệnh may, 5 sản phẩm, danh mục rỗng và toàn bộ event đã xử lý — để sau
khi deploy thật, lượt đối chiếu đêm tạo lại đầy đủ. Giữ lại 327 dòng pancake_variants
(chỉ là bộ nhớ tra cứu, giữ thì màn Tạo đơn gợi ý được ngay).
Task 15: complete (commits 593d6e8f1..819410a, tests: npm test → ℹ duration_ms 205.6967)

Task 15 (bổ sung sau khi ledger đã ghi complete): bản vá workflow để LẶP hết 89 trang
mẫu mã rồi mới gọi đối chiếu bị trượt ở lần commit đầu (chuỗi tìm-thay không khớp vì
prettier đã định dạng lại YAML). Đã sửa và commit riêng 5aea855; đã kiểm cú pháp shell
của khối `run` bằng `bash -n` → sạch. Nếu không sửa thì mỗi đêm chỉ đồng bộ 6/89 trang.

Task 16 Step 1: xong — `npm test` 40/40 xanh, `npm run build` ✓ Compiled successfully,
14 route trong đó 7 route API mới.
Task 16 Step 2: DỪNG LẠI chờ chủ xưởng. Bước kế tiếp là tạo MỘT phiếu nhập kho THẬT
1 cái trên shop đang kinh doanh rồi huỷ ngay — chủ xưởng đã đồng ý trong thiết kế
nhưng kèm điều kiện "báo trước khi chạy". PANCAKE_DRY_RUN vẫn = 1.

Task 16 Step 3-4: CHẠY THẬT XONG, KẾT QUẢ SẠCH. Mẫu A208-DEN-M, nhà cung cấp
1842006837 đúng "Xưởng nhà làm". Tồn TRƯỚC 0 → sau khi nhập 1 cái = 1 → sau khi huỷ
= 0. Phiếu mã 2287 (id 8224fb84-e4ad-48a0-a839-f0879e278891), đọc lại qua API thấy
status = 2 (Canceled). `supplier_products_id` trên phiếu trả về đúng 1842006837 —
giải toả nghi vấn ở mục 13b của spec (tài liệu Pancake có ví dụ không nhất quán).
Kết luận: đường ghi sang Pancake chạy đúng và huỷ phiếu CÓ hoàn tồn.

Task 16 Step 5: Ruling: GIỮ `PANCAKE_DRY_RUN=1` trong `.env.local` thay vì đổi sang 0
như plan viết. Plan xếp sai thứ tự: đặt 0 rồi mới chạy E2E thì chính lượt E2E sẽ tạo
phiếu nhập THẬT trên shop đang kinh doanh. Việc cần tắt tập dượt là biến môi trường
trên Vercel (production), và đó là việc của chủ xưởng vì máy này chưa đăng nhập Vercel.
Cost if wrong: chạy thử ở máy sẽ không đẩy sang Pancake — đúng ý muốn.

Task 16 Step 6: Ruling: coi phần kiểm bằng trình duyệt đã làm xuyên suốt Task 9-14 là
bước E2E, thay vì viết thêm một bộ Playwright chạy lại đúng những thao tác đó. Mọi màn
đều đã chạy trên BẢN BUILD PRODUCTION ở port 3100 với DỮ LIỆU THẬT trên Supabase, và
dữ liệu test đã dọn sạch sau mỗi lượt: ghi số cắt, bàn cắt, nhắc khi may quá số cắt,
hai kiểu xem của thợ, báo xong ở chế độ gộp (chia ngược đúng 5+1), màn Hôm nay, màn
Đơn thiếu (dòng xong tự tô xanh), tab Nhập kho Pancake (dòng lỗi + hai nút), Lịch sử
phân biệt ✂️/🧵, nhãn nguồn và KHÔNG VÀO KHO.
CHƯA KIỂM: bấm thật hai nút Xuất Excel / Xuất PDF trong trình duyệt (thao tác đó tải
file về máy). Excel đã được kiểm bằng cách gọi thẳng hàm xuất và đọc lại file.

Final review: lượt soát đầu dispatch trên Opus bị chặn ngay vì hết hạn mức phiên
(rate limit, reset 19h40). Dispatch lại trên Sonnet — vẫn là một ngữ cảnh mới, độc
lập với người làm, chỉ kém mạnh hơn. Ghi lại để chủ xưởng biết mức độ soát.

=== KẾT QUẢ SOÁT CUỐI (28/10/2026) ===
Người soát độc lập (ngữ cảnh mới, Sonnet) trả về 8 phát hiện. Chấm lại theo HẬU QUẢ
người dùng chịu, không theo nhãn của người soát:

NGHIÊM TRỌNG — vào đợt sửa:
1. `xaHangDoi` không giành việc nguyên tử trước khi gọi Pancake. Hai luồng xả (cron 5
   phút + poll 60s trong app + lượt gọi ngay khi thợ bấm Xong) cùng thấy một dòng
   pending → cùng POST /purchases → tồn Pancake +10 thay vì +5. Đây đúng là điều mục 2
   của spec gọi là thất bại tuyệt đối.
2. Route nhập kho lấy `variation_id` THẲNG TỪ BODY. Số lượng thì lấy từ DB (đúng) nhưng
   mẫu mã thì không. Gửi lại cùng production_log_ids với batch_id mới → mỗi lần một
   phiếu. Hoặc ghép log của quần với mẫu mã của áo.
3. Ba bước rời nhau ở máy thợ: updateOrder → logProduction → fetch nhập kho. Mất mạng ở
   bước ba thì hàng đã may xong KHÔNG có dòng nào trong pancake_stock_ins → vế
   "đã lo liệu" bằng 0 → lượt đồng bộ sau lại đẻ lệnh may cho đúng số hàng vừa may.
   Không có lượt đối soát nào bắt được chuyện này.
4. `xuLyMotEvent` không giành event; chuỗi đọc-tính-tạo không nguyên tử. Hai đơn cách
   nhau vài giây → hai lượt cùng thấy dangChoMay=0 → mỗi lượt tạo 5 → 10 cái cho mức
   thiếu 5. Đúng điều spec gọi là "tạo trùng lệnh may".

QUAN TRỌNG — vào đợt sửa:
5. Lỗi TẠM THỜI (Pancake 5xx/timeout) cũng bị đánh dấu processed_at → đơn mất vĩnh viễn,
   lượt đối chiếu đêm không nạp lại vì trùng khoá.
6. `layTonKhoTuoi` trả 0 khi không đọc được → coi như không thiếu → lệnh may biến mất im.
7. `if (biMat && ...)` — chưa đặt PANCAKE_WEBHOOK_SECRET thì bỏ luôn kiểm tra.
8. `surplus_flag` bật cho MỌI lệnh pending của mẫu mã và không bao giờ gỡ.

SẠCH (người soát đã soi có chủ đích):
- math.ts: dấu đúng, không âm, vế dangChoNhapKho gồm pending/error/skipped đúng.
- Payload webhook méo: cả 4 kiểu đều trả 2xx, không ném.
- Mẫu mã lạ: bỏ qua, không tạo lệnh may rác, không tạo products rác.
- gopMauMa: chia ngược không vượt số còn lại, một production_log mỗi đơn, một batch mỗi lượt.
- PANCAKE_API_KEY chỉ nằm ở route server, không NEXT_PUBLIC_, không component client nào import.

CHƯA SOÁT ĐỦ (người soát tự khai): chạy khi chưa migration (chỉ đọc code, chưa mở trình
duyệt); hồi quy phần còn lại của don-hang/page.tsx; doi-chieu-don chỉ lấy 50 đơn trang đầu.

=== ĐỢT SỬA SAU SOÁT (28/10/2026) — commit riêng ===
Đã sửa cả 4 lỗi NGHIÊM TRỌNG và 4 lỗi QUAN TRỌNG trong một đợt:

1+4 (chạy đôi): thêm bảng `pancake_locks` làm khoá dùng chung trong database (Vercel
   mỗi lượt gọi một máy riêng, không khoá bằng biến bộ nhớ được). `xaHangDoi` và
   `xuLyEventTonDong` đều giữ khoá; mỗi dòng hàng đợi còn phải GIÀNH nguyên tử
   (update ... where status = <cũ> ... select) trước khi gọi Pancake. Thêm trạng thái
   'sending' + cột `claimed_at`, dòng 'sending' quá 5 phút mới cho giành lại.
   Vế `dangChoNhapKho` nay đếm cả 'sending' — thiếu chỗ này là khoảng hở mở lại.
   `xuLyMotEvent` giành event bằng `update ... where processed_at is null ... select`.
2: route nhập kho lấy `variation_id` từ ĐƠN trong DB (qua production_logs.order_id),
   bắt mọi dòng phải cùng một mẫu mã, và từ chối dòng sản lượng đã thuộc lượt khác.
   Thêm chỉ mục DUY NHẤT trên `pancake_stock_in_logs.production_log_id`.
3: thêm `doiSoatSanLuong()` — quét 7 ngày, tìm dòng sản lượng chưa có đường vào kho
   rồi xếp vào hàng đợi với mã lượt TẤT ĐỊNH `b_log_<id>`, nên chạy lại không sinh
   phiếu thừa. Gọi từ route nhập kho mỗi lượt quét định kỳ.
5: lỗi tạm thời (Pancake 5xx, timeout, mạng) trả event về processed_at = null.
6: `layTonKhoTuoi` trả `null` khi không đọc được; mẫu mã đó bị bỏ qua, không coi là
   "không thiếu".
7: thiếu PANCAKE_WEBHOOK_SECRET nay là 500 chứ không phải cho qua.
8: gỡ `surplus_flag` khi đơn Pancake được sửa lại cho đủ.

TDD: 12 test mới cho phần thuần (`src/lib/pancake/doiSoat.ts`) — viết trước, xem đỏ,
rồi mới viết code. Tổng 52/52 xanh, `npm run build` sạch.

CHƯA KIỂM ĐƯỢC: phần giành việc và khoá chạm vào bảng/cột mà `supabase-pancake-sua.sql`
mới tạo, mà file đó CHƯA chạy trên Supabase. Phải chạy rồi mới thử được hai luồng gọi
song song. Hiện `kiem-tra-migration.mjs` báo thiếu đúng 2 thứ.
AN TOÀN KHI CHƯA CHẠY SQL: `giuKhoa` không giành được khoá → `xaHangDoi` KHÔNG gọi
Pancake và trả `banRon: true`. Tức là dừng hẳn chứ không liều — thà không nhập kho
còn hơn nhập hai lần.

=== KIỂM CHỨNG ĐỢT SỬA TRÊN DATABASE THẬT (28/10/2026) ===
Chủ xưởng đã chạy supabase-pancake-sua.sql; checker báo đủ. Bốn phép thử:

A) CHỐNG CHẠY ĐÔI — bắn hai lượt POST /api/pancake/nhap-kho CÙNG LÚC:
   lượt 1 → {"xong":0,"banRon":true} (đứng ngoài vì luồng kia giữ khoá)
   lượt 2 → {"xong":1}
   Trước bản vá: cả hai cùng gửi phiếu sang Pancake.

B) LƯỢT ĐỐI SOÁT — dựng một đơn đã may xong mà CỐ Ý không có dòng nhập kho nào
   (đúng cảnh mất mạng lúc thợ bấm Xong). Gọi body rỗng → tự nhặt lên, sinh đúng
   MỘT dòng `b_log_log_TEST_khoa`, số lượng 5 lấy từ sổ sản lượng, mẫu mã lấy từ đơn.
   Hai lượt chạy song song vẫn chỉ ra một dòng (mã lượt tất định + ràng buộc duy nhất).

C) CHỐNG GỬI LẠI — gửi lại cùng dòng sản lượng với mã lượt MỚI → 409
   "dong san luong da vao kho roi".

D) CHỐNG MẠO MẪU MÃ — gửi `variation_id: "MAU-MA-BIA-DAT"` trong body → dòng tạo ra
   mang mẫu mã THẬT lấy từ đơn (5013d4f3-…), không phải chuỗi bịa.

Đã xoá sạch dữ liệu test, bảng khoá cũng dọn. Đơn về lại 53.

=== HAI LỖI PHÁT HIỆN KHI CHẠY THẬT (28/10/2026) ===
Chủ xưởng soi đơn #67645 (khách Chi Nguyen) và bắt được hai lỗi mà cả test lẫn vòng
soát độc lập đều không thấy, vì chúng chỉ lộ ra với dữ liệu thật của shop.

LỖI 1 — may thừa gấp nhiều lần.
Đơn chỉ cần 1 cái V38-LOANG-M và 1 cái V38-BEO-M, nhưng app ra lệnh may 8 và 4.
Nguyên nhân: công thức ở mục 4 của spec lấy `thiếu = max(0, −tồn_toàn_shop)`. Tồn
V38-LOANG-M đang −8 vì tích luỹ từ nhiều đơn (và có thể cả do tồn trôi lâu ngày).
Quy tắc "tổng lệnh may = số đang thiếu" đúng ở mức toàn shop nhưng SAI ở mức MỘT đơn.
Sửa: thêm trần cứng `soLuongDonNay` vào `tinhSoCanMay` —
  canMay = min( max(0, thiếu − đã_lo_liệu), số cái mẫu mã đó trong chính đơn này ).
Vế đã_lo_liệu giữ nguyên nên vẫn không đẻ lệnh trùng giữa các đơn.
Thêm `soLuongTheoMauMa()` ở quyetDinh.ts, cộng dồn khi một mẫu mã nằm nhiều dòng.

LỖI 2 — màu thứ hai hiện ảnh của màu thứ nhất.
`baoDamSanPham` tạo dòng `products` một lần với màu/size/ảnh của mẫu mã ĐẦU TIÊN gặp
rồi không bao giờ cập nhật. Nên váy V38 màu Beo hiện ảnh màu Loang.
Sửa: sản phẩm đã có thì gộp thêm màu và size mới, lưu ảnh riêng từng màu vào
`color_images` — đúng cơ chế `imageForOrder` của thẻ đơn vẫn dùng.

ĐÃ KIỂM LẠI trên chính đơn #67645: xoá 2 lệnh may sai và sản phẩm đã tạo, cho xử lý
lại event → ra đúng 1 cái Loang + 1 cái Beo, sản phẩm V38 có colors ["Loang","Beo"]
và 2 ảnh khác nhau theo màu. Tổng test 58/58 xanh.

BÀI HỌC: số âm của Pancake là tồn tích luỹ của CẢ SHOP, không phải nhu cầu của một
đơn. Mọi quy tắc tính theo tồn phải có trần theo đơn.
