# Kết nối Pancake POS + Theo dõi số đã cắt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đơn thiếu hàng trên Pancake tự thành lệnh may trong app Xưởng 81, thợ bấm Xong thì tồn kho Pancake tự tăng, và chủ xưởng ghi được số đã cắt của từng đơn.

**Architecture:** Pancake gọi webhook → route ghi payload thô rồi trả 200 ngay → một module xử lý nền tra `pancake_variants`, lọc nhà cung cấp "Xưởng nhà làm", tính chênh lệch giữa số Pancake đang thiếu và số app đã lo liệu, rồi tạo lệnh may. Chiều ngược lại, mỗi lượt báo xong sinh một `batch_id`, xếp vào hàng đợi `pancake_stock_ins` và gọi `POST /purchases`. Toàn bộ quyết định (tính số, chia ngược, gộp mẫu mã, kẹp số cắt) nằm trong các module thuần không phụ thuộc mạng ở `src/lib/pancake/` và `src/lib/`, để chạy test bằng bộ chạy test có sẵn của Node.

**Tech Stack:** Next.js 14 App Router, React 18 client components, Supabase JS (anon key, RLS mở), Web Push đã có sẵn, `node --test` (có sẵn trong Node 24, không cài thêm), GitHub Actions làm bộ hẹn giờ. Hai gói mới duy nhất: `xlsx` và `pdfmake`.

**Spec:** `docs/superpowers/specs/2026-10-27-ket-noi-pancake-design.md`

## Global Constraints

- Shop ID `970675`. Nhà cung cấp "Xưởng nhà làm" id `1842006837`. Kho "Khohang 81 - Grace's Sweet" id `c4f2c739-a5a9-4f36-911f-26323b6a21cd`. Ba giá trị này là hằng số, không dò lại lúc chạy.
- `PANCAKE_API_KEY` **không** có tiền tố `NEXT_PUBLIC_`; chỉ dùng trong route server. Không bao giờ gửi xuống trình duyệt.
- Mọi lời gọi ghi sang Pancake phải đi qua công tắc `PANCAKE_DRY_RUN`: bật thì ghi lại payload vào `pancake_stock_ins.error_message` với tiền tố `DRY_RUN:` và đánh `status='ok'`, không gọi mạng.
- **Code phải chạy được cả khi chưa chạy migration.** Mọi truy vấn cột/bảng mới phải chịu được lỗi "column does not exist" mà không làm trắng màn hình.
- Bảng `orders` **không có** `updated_at` — không ghi vào. Bảng `products` **không có** cột `variants`.
- Giá nhập trên phiếu nhập kho: `imported_price: 0`, `gross_price: 0`, `discount: 0`, `not_create_transaction: true`, `auto_create_debts: false`.
- Hạn may mặc định: hôm nay + **2 ngày**. Mức ưu tiên lệnh may mới: `normal`.
- Chỉ xử lý đơn Pancake trạng thái `0` (Mới) và `1` (Đã xác nhận).
- App thợ **không hiện** tên khách, số điện thoại, mã vận đơn.
- Chữ hiển thị giữ nguyên tiếng Việt có dấu. Giữ màu xanh `#1976D2`, bố cục mobile 480px, nav dưới.
- Không commit/push từng task. Commit tại chỗ theo plan, nhưng **không `git push`** cho tới khi chủ xưởng đồng ý đẩy cả loạt (xem Task 16).

## Review Focus

1. **Payload webhook méo** — thiếu `items`, `items` rỗng, `variation_id` null, JSON hỏng: route phải vẫn trả 2xx (Pancake tự tắt webhook nếu URL trả lỗi) và ghi lý do, không ném 500. → test ở Task 6.
2. **Mẫu mã lạ không tra được** — không có trong `pancake_variants` và API lấy lẻ cũng không trả: bỏ qua, ghi lý do vào `pancake_webhook_events.error`, **không** tạo lệnh may rác và không tạo `products` rác. → test ở Task 7.
3. **Đơn Pancake sửa giảm** xuống dưới số đã cắt hoặc đã may: gắn cờ dư, không xoá lệnh may, không để `remaining_quantity` hay `cut_quantity` xuống âm. → test ở Task 7 và Task 9.
4. **Hai lượt báo xong sát nhau cùng một mẫu mã**: mỗi lượt một `batch_id` riêng, ràng buộc duy nhất chặn phiếu nhập trùng, và vế `đã_lo_liệu` tính cả hàng đợi để không đẻ lệnh may mới trong khoảng trống. → test ở Task 1 và Task 8.
5. **Chạy khi chưa chạy migration**: mở app không trắng màn, màn Đơn hàng vẫn dùng được, các khối mới tự ẩn. → test ở Task 4.

---

## Task 1: Bộ chạy test + công thức tính số cần may

**Files:**

- Create: `src/lib/pancake/math.ts`
- Create: `tests/unit/pancake-math.test.ts`
- Modify: `package.json` (thêm script `test`)
- Modify: `tsconfig.json` (thêm `"tests"` vào `exclude`)

**Interfaces:**

- Consumes: không gì.
- Produces:

  ```ts
  export interface SoLieuMauMa {
    remainQuantity: number; // remain_quantity tươi từ Pancake, có thể âm
    dangChoMay: number; // tổng quantity lệnh may status='pending'
    dangChoNhapKho: number; // tổng quantity pancake_stock_ins status pending|error|skipped
  }
  export interface KetQuaCanMay {
    canMay: number; // >= 0, số cái cần tạo lệnh may mới
    mayDu: number; // >= 0, số cái có thể đã may dư
  }
  export function tinhSoCanMay(s: SoLieuMauMa): KetQuaCanMay;
  ```

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/unit/pancake-math.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { tinhSoCanMay } from "../../src/lib/pancake/math.ts";

test("thiếu 5 cái, chưa lo gì → may 5", () => {
  assert.deepEqual(
    tinhSoCanMay({ remainQuantity: -5, dangChoMay: 0, dangChoNhapKho: 0 }),
    { canMay: 5, mayDu: 0 },
  );
});

test("thiếu 5 cái, đã có lệnh may 5 → không tạo thêm", () => {
  assert.deepEqual(
    tinhSoCanMay({ remainQuantity: -5, dangChoMay: 5, dangChoNhapKho: 0 }),
    { canMay: 0, mayDu: 0 },
  );
});

test("thợ báo xong rồi nhưng phiếu nhập kho chưa vào → không đẻ lệnh may mới", () => {
  assert.deepEqual(
    tinhSoCanMay({ remainQuantity: -8, dangChoMay: 0, dangChoNhapKho: 8 }),
    { canMay: 0, mayDu: 0 },
  );
});

test("tồn dương → không may", () => {
  assert.deepEqual(
    tinhSoCanMay({ remainQuantity: 12, dangChoMay: 0, dangChoNhapKho: 0 }),
    { canMay: 0, mayDu: 0 },
  );
});

test("đơn bị huỷ sau khi đã lên lệnh may → báo may dư, không trả số âm", () => {
  assert.deepEqual(
    tinhSoCanMay({ remainQuantity: 0, dangChoMay: 5, dangChoNhapKho: 0 }),
    { canMay: 0, mayDu: 5 },
  );
});

test("thiếu nhiều hơn phần đã lo → chỉ may đúng phần chênh", () => {
  assert.deepEqual(
    tinhSoCanMay({ remainQuantity: -10, dangChoMay: 3, dangChoNhapKho: 2 }),
    { canMay: 5, mayDu: 0 },
  );
});
```

- [ ] **Step 2: Thêm script test và loại `tests/` khỏi type-check**

Trong `package.json` thêm `"test": "node --test \"tests/unit/**/*.test.ts\""`. Trong `tsconfig.json` đổi `"exclude"` thành `["node_modules", "tests"]` — thư mục `tests` import source bằng đuôi `.ts` (Node yêu cầu), mà `npm run build` không chấp nhận đuôi đó.

- [ ] **Step 3: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../src/lib/pancake/math.ts'`

- [ ] **Step 4: Viết `tinhSoCanMay` trong `src/lib/pancake/math.ts`**

File này **không được import gì** — không Supabase, không React. Công thức lấy nguyên từ mục 4 của spec: `thiếu = max(0, −remainQuantity)`, `đãLo = dangChoMay + dangChoNhapKho`, `chênh = thiếu − đãLo`, rồi tách thành `canMay = max(0, chênh)` và `mayDu = max(0, −chênh)`.

- [ ] **Step 5: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json src/lib/pancake/math.ts tests/unit/pancake-math.test.ts
git commit -m "feat(pancake): cong thuc tinh so can may + bo chay test"
```

---

## Task 2: Chia ngược số lượng khi thợ báo xong ở chế độ gộp

**Files:**

- Create: `src/lib/gopMauMa.ts`
- Create: `tests/unit/gop-mau-ma.test.ts`

**Interfaces:**

- Consumes: `Order` từ `src/lib/mockData.ts` (chỉ các trường `id`, `remaining_quantity`, `due_date`, `created_at`).
- Produces:

  ```ts
  export interface DonDeChia {
    id: string;
    remaining_quantity: number;
    due_date: string | null;
    created_at: string;
  }
  export interface PhanChia {
    order_id: string;
    quantity: number;
  }
  // Chia soBaoXong về từng đơn. Bỏ các đơn nhận 0 cái ra khỏi kết quả.
  export function chiaNguocSoLuong(
    dons: DonDeChia[],
    soBaoXong: number,
    homNay: string, // "YYYY-MM-DD"
  ): PhanChia[];
  ```

- [ ] **Step 1: Viết test thất bại**

```ts
// tests/unit/gop-mau-ma.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chiaNguocSoLuong } from "../../src/lib/gopMauMa.ts";

const A = {
  id: "A",
  remaining_quantity: 5,
  due_date: "2026-10-26",
  created_at: "2026-10-20T08:00:00Z",
};
const B = {
  id: "B",
  remaining_quantity: 3,
  due_date: "2026-10-28",
  created_at: "2026-10-21T08:00:00Z",
};

test("ví dụ trong thiết kế: gộp 8 cái, báo xong 6 → A nhận đủ 5, B nhận 1", () => {
  assert.deepEqual(chiaNguocSoLuong([B, A], 6, "2026-10-27"), [
    { order_id: "A", quantity: 5 },
    { order_id: "B", quantity: 1 },
  ]);
});

test("đơn trễ hạn nhận trước dù tạo sau", () => {
  const tre = { ...B, id: "TRE", due_date: "2026-10-25" };
  assert.deepEqual(
    chiaNguocSoLuong([A, tre], 3, "2026-10-27")[0].order_id,
    "TRE",
  );
});

test("cùng mức trễ thì đơn hạn gần hơn nhận trước", () => {
  assert.equal(chiaNguocSoLuong([B, A], 1, "2026-10-20")[0].order_id, "A");
});

test("đơn không có hạn xếp sau cùng", () => {
  const khongHan = { ...B, id: "KH", due_date: null };
  assert.equal(
    chiaNguocSoLuong([khongHan, B], 1, "2026-10-20")[0].order_id,
    "B",
  );
});

test("báo xong nhiều hơn tổng còn lại → chỉ chia hết phần có thật", () => {
  assert.deepEqual(chiaNguocSoLuong([A, B], 99, "2026-10-27"), [
    { order_id: "A", quantity: 5 },
    { order_id: "B", quantity: 3 },
  ]);
});

test("báo xong 0 → không chia cho ai", () => {
  assert.deepEqual(chiaNguocSoLuong([A, B], 0, "2026-10-27"), []);
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../src/lib/gopMauMa.ts'`

- [ ] **Step 3: Viết `chiaNguocSoLuong` trong `src/lib/gopMauMa.ts`**

Thứ tự xếp theo mục 9a: đơn trễ hạn (`due_date < homNay`) lên trước, rồi hạn gần nhất, `due_date` null xếp cuối, rồi `created_at` sớm hơn. Mỗi đơn nhận cho đủ `remaining_quantity` của nó rồi mới sang đơn kế. File không import Supabase.

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gopMauMa.ts tests/unit/gop-mau-ma.test.ts
git commit -m "feat(gop): chia nguoc so luong ve tung don"
```

---

## Task 3: Gộp danh sách đơn theo mẫu mã

**Files:**

- Modify: `src/lib/gopMauMa.ts`
- Modify: `tests/unit/gop-mau-ma.test.ts`
- Create: `tests/unit/_donMau.ts` (Task 12 và Task 15 dùng lại)

**Interfaces:**

- Consumes: `Order` (`src/lib/mockData.ts`), `chiaNguocSoLuong` từ Task 2.
- Produces:

  ```ts
  export interface NhomMauMa {
    khoa: string; // pancake_variation_id, hoặc `${product_id}|${color}|${size}`
    product_id: string;
    color: string;
    size: string;
    pancake_variation_id: string | null;
    tongConLai: number; // tổng remaining_quantity
    soDon: number;
    hanGapNhat: string | null; // due_date nhỏ nhất, null xếp sau
    coDonTre: boolean;
    dons: Order[]; // đã xếp theo thứ tự chia ngược
  }
  export function gomTheoMauMa(orders: Order[], homNay: string): NhomMauMa[];
  ```

- [ ] **Step 1: Viết test thất bại**

```ts
test("hai đơn cùng mẫu mã gộp thành một nhóm, cộng số lượng", () => {
  const nhom = gomTheoMauMa(
    [
      donMau({ id: "A", pancake_variation_id: "v1", remaining_quantity: 5 }),
      donMau({ id: "B", pancake_variation_id: "v1", remaining_quantity: 3 }),
    ],
    "2026-10-27",
  );
  assert.equal(nhom.length, 1);
  assert.equal(nhom[0].tongConLai, 8);
  assert.equal(nhom[0].soDon, 2);
});

test("đơn không có mẫu mã Pancake gộp theo sản phẩm + màu + size", () => {
  const nhom = gomTheoMauMa(
    [
      donMau({ id: "A", pancake_variation_id: null, color: "ĐEN", size: "M" }),
      donMau({ id: "B", pancake_variation_id: null, color: "ĐEN", size: "M" }),
      donMau({ id: "C", pancake_variation_id: null, color: "ĐEN", size: "L" }),
    ],
    "2026-10-27",
  );
  assert.equal(nhom.length, 2);
});

test("hạn của nhóm lấy theo đơn gấp nhất, và cờ trễ bật lên", () => {
  const nhom = gomTheoMauMa(
    [
      donMau({ id: "A", due_date: "2026-10-29" }),
      donMau({ id: "B", due_date: "2026-10-25" }),
    ],
    "2026-10-27",
  );
  assert.equal(nhom[0].hanGapNhat, "2026-10-25");
  assert.equal(nhom[0].coDonTre, true);
});

test("đơn trong nhóm xếp sẵn theo đúng thứ tự chia ngược", () => {
  const nhom = gomTheoMauMa(
    [
      donMau({ id: "SAU", due_date: "2026-10-29" }),
      donMau({ id: "TRUOC", due_date: "2026-10-25" }),
    ],
    "2026-10-27",
  );
  assert.deepEqual(
    nhom[0].dons.map((d) => d.id),
    ["TRUOC", "SAU"],
  );
});
```

Tạo `tests/unit/_donMau.ts` xuất `donMau(ghiDe: Partial<Order>): Order` — trả về một `Order` đủ trường với giá trị mặc định. Task 12 và Task 15 dùng lại đúng hàm này.

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL — `gomTheoMauMa is not a function`

- [ ] **Step 3: Viết `gomTheoMauMa` trong `src/lib/gopMauMa.ts`**

Dùng lại hàm xếp thứ tự của Task 2 cho mảng `dons` bên trong mỗi nhóm.

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gopMauMa.ts tests/unit/gop-mau-ma.test.ts
git commit -m "feat(gop): gom don theo mau ma"
```

---

## Task 4: Migration SQL + script kiểm tra

**Files:**

- Create: `supabase-pancake.sql`
- Create: `scripts/kiem-tra-migration.mjs`

**Interfaces:**

- Produces: các bảng và cột mà mọi task sau dựa vào. Tên cột viết đúng như mục 8 và 9c của spec.

- [ ] **Step 1: Viết `supabase-pancake.sql`**

Nội dung, mọi lệnh đều `IF NOT EXISTS` để dán lại nhiều lần không hỏng:

- `CREATE TABLE pancake_variants` — `variation_id TEXT PRIMARY KEY`, `display_id`, `product_id`, `product_name`, `color`, `size`, `image_url`, `supplier_ids TEXT[]`, `retail_price NUMERIC`, `remain_quantity INTEGER`, `synced_at TIMESTAMPTZ`.
- `CREATE TABLE pancake_webhook_events` — `id UUID PK DEFAULT gen_random_uuid()`, `order_id TEXT`, `updated_at TEXT`, `payload JSONB`, `received_at TIMESTAMPTZ DEFAULT now()`, `processed_at TIMESTAMPTZ`, `error TEXT`, cộng `UNIQUE (order_id, updated_at)`.
- `CREATE TABLE pancake_stock_ins` — `id UUID PK`, `batch_id TEXT NOT NULL UNIQUE`, `variation_id TEXT`, `quantity INTEGER`, `status TEXT NOT NULL DEFAULT 'pending'`, `attempts INTEGER DEFAULT 0`, `purchase_display_id TEXT`, `error_message TEXT`, `notified_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT now()`, `completed_at TIMESTAMPTZ`.
- `CREATE TABLE pancake_stock_in_logs` — `batch_id TEXT`, `production_log_id TEXT`, `PRIMARY KEY (batch_id, production_log_id)`.
- `CREATE TABLE cutting_logs` — `id UUID PK`, `order_id TEXT`, `product_id TEXT`, `quantity INTEGER`, `created_by TEXT`, `created_at TIMESTAMPTZ DEFAULT now()`.
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS` cho: `source TEXT DEFAULT 'manual'`, `cut_quantity INTEGER NOT NULL DEFAULT 0`, `pancake_order_id`, `pancake_order_display_id`, `pancake_customer_name`, `pancake_customer_phone`, `pancake_tracking_code`, `pancake_carrier`, `pancake_order_status`, `pancake_variation_id`, `pancake_sku`, `image_url`, `surplus_flag BOOLEAN DEFAULT false`.
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS` cho: `source TEXT DEFAULT 'manual'`, `pancake_product_id TEXT`.
- Backfill một lần: `UPDATE orders SET cut_quantity = quantity WHERE cut_quantity = 0 AND created_at < now();` — đơn đang có coi như đã cắt đủ (mục 11 của spec).
- Bật RLS allow-all cho 5 bảng mới, đúng kiểu các bảng cũ trong `supabase-migration.sql`.
- Thêm 5 bảng mới vào publication realtime, đúng kiểu `supabase-enable-realtime.sql`.

- [ ] **Step 2: Viết `scripts/kiem-tra-migration.mjs`**

Đọc `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` từ `.env.local`, `SELECT` một dòng từ mỗi bảng mới và `SELECT cut_quantity, source FROM orders LIMIT 1`, in `OK <tên>` hoặc `THIẾU <tên>: <lỗi>`, thoát mã 1 nếu có thiếu.

- [ ] **Step 3: Chạy script để xác nhận nó báo thiếu**

Run: `node scripts/kiem-tra-migration.mjs`
Expected: in `THIẾU pancake_variants…` và thoát mã 1 (migration chưa chạy)

- [ ] **Step 4: Nhờ chủ xưởng dán SQL vào Supabase SQL Editor**

Đây là bước thủ công bắt buộc — máy này không có Supabase CLI, không có mật khẩu DB, không có service_role key. Dừng lại, đưa đường dẫn file, chờ xác nhận.

- [ ] **Step 5: Chạy lại script để xác nhận đủ**

Run: `node scripts/kiem-tra-migration.mjs`
Expected: in `OK` cho cả 5 bảng và 2 cột, thoát mã 0

- [ ] **Step 6: Commit**

```bash
git add supabase-pancake.sql scripts/kiem-tra-migration.mjs
git commit -m "feat(db): migration pancake + so cat"
```

---

## Task 5: Module gọi Pancake và payload phiếu nhập kho

**Files:**

- Create: `src/lib/pancake/payload.ts`
- Create: `src/lib/pancake/api.ts`
- Create: `src/lib/supabaseServer.ts`
- Create: `tests/unit/pancake-payload.test.ts`
- Modify: `.env.local` (thêm biến, không commit)

**Interfaces:**

- Consumes: không gì từ task trước.
- Produces:

  ```ts
  // payload.ts — thuần, không mạng
  export const SHOP_ID = "970675";
  export const WAREHOUSE_ID = "c4f2c739-a5a9-4f36-911f-26323b6a21cd";
  export const SUPPLIER_ID = 1842006837;
  export interface MucNhapKho {
    variation_id: string;
    quantity: number;
  }
  export function dungPayloadNhapKho(items: MucNhapKho[], note: string): object;

  // api.ts — có mạng, chỉ dùng ở server
  export function dangTapDuot(): boolean; // PANCAKE_DRY_RUN === "1"
  export async function layMauMa(
    variationIds: string[],
  ): Promise<PancakeVariant[]>;
  export async function layDonHang(
    orderId: string,
  ): Promise<PancakeOrder | null>;
  export async function layTonKhoTuoi(variationId: string): Promise<number>;
  export async function taoPhieuNhapKho(
    items: MucNhapKho[],
    note: string,
  ): Promise<{ ok: true; displayId: string } | { ok: false; loi: string }>;
  export async function huyPhieuNhapKho(purchaseId: string): Promise<boolean>;

  // supabaseServer.ts
  export const supabaseServer: SupabaseClient; // createClient với NEXT_PUBLIC_* , không persist session
  ```

- [ ] **Step 1: Viết test thất bại cho payload**

```ts
// tests/unit/pancake-payload.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dungPayloadNhapKho,
  WAREHOUSE_ID,
  SUPPLIER_ID,
} from "../../src/lib/pancake/payload.ts";

test("phiếu nhập đúng kho, đúng nhà cung cấp, giá 0, không sinh công nợ", () => {
  const p: any = dungPayloadNhapKho(
    [{ variation_id: "v1", quantity: 8 }],
    "Xưởng 81 tự nhập",
  );
  assert.equal(p.purchase.warehouse_id, WAREHOUSE_ID);
  assert.equal(p.purchase.supplier_products_id, SUPPLIER_ID);
  assert.equal(p.purchase.status, 1);
  assert.equal(p.purchase.not_create_transaction, true);
  assert.equal(p.purchase.auto_create_debts, false);
  assert.deepEqual(p.purchase.items[0], {
    variation_id: "v1",
    quantity: 8,
    imported_price: 0,
    gross_price: 0,
    discount: 0,
    index: 0,
  });
});

test("nhiều mục thì index tăng dần từ 0", () => {
  const p: any = dungPayloadNhapKho(
    [
      { variation_id: "v1", quantity: 1 },
      { variation_id: "v2", quantity: 2 },
    ],
    "x",
  );
  assert.deepEqual(
    p.purchase.items.map((i: any) => i.index),
    [0, 1],
  );
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL — không tìm thấy module

- [ ] **Step 3: Viết `payload.ts`, rồi `api.ts` và `supabaseServer.ts`**

`api.ts` gọi `https://pos.pages.fm/api/v1/...` với `api_key` trong query string, đọc `process.env.PANCAKE_API_KEY`. `layMauMa` dùng `GET /shops/{SHOP_ID}/products/variations?variation_ids[]=…`; `layTonKhoTuoi` lấy `remain_quantity` của kho `WAREHOUSE_ID` trong kết quả đó. `taoPhieuNhapKho` khi `dangTapDuot()` trả `{ ok: true, displayId: "DRY_RUN" }` mà không gọi mạng. Mọi lỗi mạng trả `{ ok: false, loi }`, không ném.

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Thêm biến môi trường vào `.env.local`**

`PANCAKE_API_KEY`, `PANCAKE_WEBHOOK_SECRET` (tự sinh chuỗi ngẫu nhiên 32 ký tự), `CRON_SECRET` (tự sinh), `PANCAKE_DRY_RUN=1`. Để `DRY_RUN=1` cho tới Task 16.

- [ ] **Step 6: Kiểm chứng đọc được dữ liệu thật**

Run: `node -e "..."` gọi `layMauMa` với một `variation_id` lấy từ `context`/API, in ra `display_id` và `supplier_ids`.
Expected: in ra đúng mã mẫu mã, và `supplier_ids` có chứa `1842006837`

- [ ] **Step 7: Commit**

```bash
git add src/lib/pancake/payload.ts src/lib/pancake/api.ts src/lib/supabaseServer.ts tests/unit/pancake-payload.test.ts
git commit -m "feat(pancake): module goi API + payload nhap kho"
```

---

## Task 6: Route webhook — nhận và trả 200 ngay

**Files:**

- Create: `src/app/api/pancake/webhook/route.ts`

**Interfaces:**

- Consumes: `supabaseServer` (Task 5).
- Produces: dòng trong `pancake_webhook_events` với `order_id`, `updated_at`, `payload`; route `POST /api/pancake/webhook`.

- [ ] **Step 1: Viết route**

Kiểm tra header `x-xuong81-secret` khớp `PANCAKE_WEBHOOK_SECRET` → sai thì `401`. Đọc body, lấy `order_id` và `updated_at` từ payload, `upsert` vào `pancake_webhook_events` theo khoá `(order_id, updated_at)` với `onConflict` bỏ qua, rồi **trả `200` ngay**. Gọi route xử lý bằng `fetch` không `await` (fire-and-forget). Toàn bộ thân hàm bọc `try/catch`: mọi lỗi vẫn trả `200` kèm `{ ok: false, loi }`, vì Pancake tự tắt webhook của shop khi URL trả lỗi.

- [ ] **Step 2: Chạy server và thử sai mã bí mật**

```bash
npm run build && npm start -- -p 3100 &
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3100/api/pancake/webhook -H 'content-type: application/json' -d '{}'
```

Expected: `401`

- [ ] **Step 3: Thử các payload méo — đều phải trả 200**

```bash
S=$(grep PANCAKE_WEBHOOK_SECRET .env.local | cut -d= -f2)
for BODY in '{}' '{"id":"1"}' '{"id":"1","items":[]}' '{"id":"1","items":[{"variation_id":null}]}' 'khong-phai-json'; do
  curl -s -o /dev/null -w "%{http_code} " -X POST localhost:3100/api/pancake/webhook \
    -H "x-xuong81-secret: $S" -H 'content-type: application/json' -d "$BODY"
done
```

Expected: `200 200 200 200 200`

- [ ] **Step 4: Thử payload thật và xác nhận có dòng trong bảng**

Gửi lại một payload đơn thật (lấy từ `layDonHang` của Task 5), rồi `SELECT` từ `pancake_webhook_events`.
Expected: đúng 1 dòng; gửi lại lần hai cùng `updated_at` vẫn chỉ 1 dòng

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pancake/webhook/route.ts
git commit -m "feat(pancake): route webhook nhan don"
```

---

## Task 7: Xử lý event → tạo và cập nhật lệnh may

**Files:**

- Create: `src/lib/pancake/quyetDinh.ts`
- Create: `src/lib/pancake/xuLyDon.ts`
- Create: `src/app/api/pancake/xu-ly/route.ts`
- Create: `tests/unit/pancake-quyet-dinh.test.ts`

**Interfaces:**

- Consumes: `tinhSoCanMay` (Task 1), `layMauMa` / `layTonKhoTuoi` (Task 5), `supabaseServer`.
- Produces:

  ```ts
  // quyetDinh.ts — thuần
  export interface DongHang {
    variation_id: string | null;
    quantity: number;
  }
  export interface DonPancake {
    id: string;
    status: number;
    items: DongHang[];
  }
  export type LyDoBoQua =
    "trang-thai" | "khong-co-mau-ma" | "khong-phai-xuong-nha";
  export interface MauMaCanXet {
    variation_id: string;
    supplier_ids: string[];
  }
  // Lọc ra những mẫu mã của đơn này mà xưởng phải may.
  export function locMauMaCanMay(
    don: DonPancake,
    traCuu: Map<string, MauMaCanXet>,
  ): {
    canXet: string[];
    boQua: { variation_id: string | null; lyDo: LyDoBoQua }[];
  };

  // xuLyDon.ts — có mạng
  export async function xuLyMotEvent(eventId: string): Promise<void>;
  export async function baoDamSanPham(mauMa: PancakeVariant): Promise<string>; // trả products.id
  ```

- [ ] **Step 1: Viết test thất bại cho `locMauMaCanMay`**

```ts
const traCuu = new Map([
  ["xuong", { variation_id: "xuong", supplier_ids: ["1842006837"] }],
  ["ngoai", { variation_id: "ngoai", supplier_ids: ["999"] }],
]);

test("chỉ may mẫu mã của Xưởng nhà làm", () => {
  const r = locMauMaCanMay(
    {
      id: "1",
      status: 0,
      items: [
        { variation_id: "xuong", quantity: 1 },
        { variation_id: "ngoai", quantity: 1 },
      ],
    },
    traCuu,
  );
  assert.deepEqual(r.canXet, ["xuong"]);
  assert.equal(r.boQua[0].lyDo, "khong-phai-xuong-nha");
});

test("đơn đã gửi hàng thì bỏ qua cả đơn", () => {
  const r = locMauMaCanMay(
    { id: "1", status: 3, items: [{ variation_id: "xuong", quantity: 1 }] },
    traCuu,
  );
  assert.deepEqual(r.canXet, []);
  assert.equal(r.boQua[0].lyDo, "trang-thai");
});

test("đơn mới và đơn đã xác nhận đều xử lý", () => {
  for (const status of [0, 1]) {
    const r = locMauMaCanMay(
      { id: "1", status, items: [{ variation_id: "xuong", quantity: 1 }] },
      traCuu,
    );
    assert.deepEqual(r.canXet, ["xuong"]);
  }
});

test("mẫu mã lạ không tra được thì bỏ qua, không đoán", () => {
  const r = locMauMaCanMay(
    { id: "1", status: 0, items: [{ variation_id: "la", quantity: 1 }] },
    traCuu,
  );
  assert.deepEqual(r.canXet, []);
  assert.equal(r.boQua[0].lyDo, "khong-co-mau-ma");
});

test("dòng hàng không có variation_id thì bỏ qua, không đổ", () => {
  const r = locMauMaCanMay(
    { id: "1", status: 0, items: [{ variation_id: null, quantity: 1 }] },
    traCuu,
  );
  assert.deepEqual(r.canXet, []);
  assert.equal(r.boQua[0].lyDo, "khong-co-mau-ma");
});

test("items rỗng hoặc thiếu thì trả mảng rỗng, không ném", () => {
  assert.deepEqual(
    locMauMaCanMay({ id: "1", status: 0, items: [] }, traCuu).canXet,
    [],
  );
  assert.deepEqual(
    locMauMaCanMay({ id: "1", status: 0 } as any, traCuu).canXet,
    [],
  );
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: Viết `locMauMaCanMay` trong `src/lib/pancake/quyetDinh.ts`**

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Viết `baoDamSanPham` trong `src/lib/pancake/xuLyDon.ts`**

Tra `products` theo `pancake_product_id`; chưa có thì tạo mới với `source='pancake'`, tên lấy từ `product_name`, `main_image_url` là đường dẫn ảnh Pancake, danh mục tra theo tên danh mục Pancake và tạo nếu chưa có. Trả `products.id`. Không bao giờ tạo `products` cho mẫu mã đã bị `locMauMaCanMay` loại.

- [ ] **Step 6: Viết `xuLyMotEvent`**

Thứ tự: đọc event → `locMauMaCanMay` (tra `pancake_variants`, thiếu thì `layMauMa` lấy lẻ rồi lưu lại) → với mỗi mẫu mã còn lại, `layTonKhoTuoi` + đếm `orders` `pending` + đếm `pancake_stock_ins` chưa xong → `tinhSoCanMay` → `canMay > 0` thì `baoDamSanPham` rồi `addOrder` với `source='pancake'`, hạn hôm nay + 2 ngày, `priority='normal'`, kèm `pancake_order_id`, `pancake_customer_name`, `pancake_customer_phone`, `pancake_variation_id`, `pancake_sku`, `image_url`; `mayDu > 0` thì bật `surplus_flag` trên các lệnh may `pending` của mẫu mã đó. Luôn cập nhật `pancake_tracking_code`, `pancake_carrier`, `pancake_order_status` cho các lệnh may đã có của đơn này. Ghi `processed_at`, hoặc `error` nếu hỏng. Tạo lệnh may xong thì gọi đẩy thông báo cho thợ qua `/api/send-push`.

- [ ] **Step 7: Viết route `POST /api/pancake/xu-ly`**

Nhận `{ eventId }` hoặc không có gì (xử lý mọi event `processed_at IS NULL`). Chặn bằng header `x-xuong81-secret`.

- [ ] **Step 8: Chạy thử đầu-cuối với một đơn thật**

Gửi payload đơn thật vào webhook, rồi `SELECT` từ `orders`.
Expected: đúng 1 lệnh may mới, `source='pancake'`, số lượng đúng bằng số Pancake đang thiếu; gửi lại cùng payload lần hai **không** sinh thêm lệnh may

- [ ] **Step 9: Commit**

```bash
git add src/lib/pancake/quyetDinh.ts src/lib/pancake/xuLyDon.ts src/app/api/pancake/xu-ly/route.ts tests/unit/pancake-quyet-dinh.test.ts
git commit -m "feat(pancake): tao lenh may tu don pancake"
```

---

## Task 8: Hàng đợi nhập kho + ba lớp thử lại

**Files:**

- Create: `src/lib/pancake/nhapKho.ts`
- Create: `src/app/api/pancake/nhap-kho/route.ts`
- Create: `tests/unit/nhap-kho.test.ts`
- Modify: `src/lib/supabaseService.ts` (thêm hàm đọc/ghi hàng đợi)

**Interfaces:**

- Consumes: `taoPhieuNhapKho` (Task 5), `chiaNguocSoLuong` (Task 2).
- Produces:

  ```ts
  export function sinhBatchId(): string; // thời gian + ngẫu nhiên, duy nhất mỗi lượt báo xong
  export interface ViecNhapKho {
    batch_id: string;
    variation_id: string;
    quantity: number;
    production_log_ids: string[];
  }
  export async function xepHangNhapKho(viec: ViecNhapKho): Promise<void>;
  export async function xaHangDoi(
    gioiHan?: number,
  ): Promise<{ xong: number; loi: number }>;
  export function gomMucNhapKho(
    muc: { variation_id: string; quantity: number }[],
  ): { variation_id: string; quantity: number }[];
  export async function danhDauTuNhapTay(batchId: string): Promise<void>;
  ```

- [ ] **Step 1: Viết test thất bại cho phần thuần**

```ts
test("mỗi lượt báo xong sinh một batch_id khác nhau", () => {
  const a = new Set(Array.from({ length: 200 }, () => sinhBatchId()));
  assert.equal(a.size, 200);
});

test("gộp nhiều lệnh may cùng mẫu mã thành một mục nhập kho", () => {
  assert.deepEqual(
    gomMucNhapKho([
      { variation_id: "v1", quantity: 5 },
      { variation_id: "v1", quantity: 3 },
      { variation_id: "v2", quantity: 2 },
    ]),
    [
      { variation_id: "v1", quantity: 8 },
      { variation_id: "v2", quantity: 2 },
    ],
  );
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: Viết `nhapKho.ts`**

`xepHangNhapKho` ghi một dòng `pancake_stock_ins` (`batch_id` UNIQUE chặn trùng) cộng các dòng `pancake_stock_in_logs`. `xaHangDoi` lấy các dòng `status IN ('pending','error')`, gọi `taoPhieuNhapKho`, cập nhật `status`/`attempts`/`purchase_display_id`/`error_message`. Thử ngay 3 lần cách nhau ~7 giây trong chính lượt gọi. `danhDauTuNhapTay` đặt `status='skipped'` — dòng `skipped` vẫn được đếm vào `dangChoNhapKho` vĩnh viễn (Task 7 Step 6).

Hết ba lớp vẫn hỏng thì đặt `status='error'`, **đẩy Web Push cho chủ xưởng ngay** qua `/api/send-push` và ghi `notified_at` để không báo lại dòng đó nữa. Route `/api/pancake/nhap-kho` phải **tự kiểm tra các `production_log_id` có thật** trước khi gọi Pancake, vì app ghi bằng anon key và RLS đang mở hết.

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Nối vào chỗ thợ bấm Xong**

Trong `src/app/don-hang/page.tsx`, sau khi `logProduction` thành công ở cả `confirmDone` và `confirmPartial`: sinh `batch_id`, gọi route `/api/pancake/nhap-kho`. **Không `await` chặn giao diện** — thợ thấy "Đã xong" ngay, việc nhập kho chạy ngầm. Đơn không có `pancake_variation_id` thì bỏ qua hoàn toàn.

- [ ] **Step 6: Thử hai lượt báo xong sát nhau**

Gọi route hai lần với **cùng** `batch_id`, rồi `SELECT count(*) FROM pancake_stock_ins WHERE batch_id = …`.
Expected: đúng 1 dòng; lần gọi thứ hai không tạo phiếu nhập thứ hai

- [ ] **Step 7: Commit**

```bash
git add src/lib/pancake/nhapKho.ts src/app/api/pancake/nhap-kho/route.ts src/lib/supabaseService.ts src/app/don-hang/page.tsx tests/unit/nhap-kho.test.ts
git commit -m "feat(pancake): hang doi nhap kho khi may xong"
```

---

## Task 9: Ghi số đã cắt

**Files:**

- Create: `src/lib/cat.ts`
- Create: `tests/unit/cat.test.ts`
- Modify: `src/lib/supabaseService.ts`
- Modify: `src/app/don-hang/page.tsx`

**Interfaces:**

- Consumes: `Order`.
- Produces:

  ```ts
  // cat.ts — thuần
  export interface KetQuaKepCat {
    cutQuantity: number; // giá trị mới, đã kẹp
    catDu: boolean; // vượt quantity
    canhBao: string | null;
  }
  export function kepSoCat(don: Order, soMoi: number): KetQuaKepCat;
  export function soMayDuoc(don: Order): number; // cut_quantity − đã may, không âm
  export function tongChuaCat(dons: Order[]): number;

  // supabaseService.ts
  export async function ghiSoCat(
    don: Order,
    soCatThem: number,
    nguoiGhi: string,
  ): Promise<string | null>; // trả thông báo lỗi tiếng Việt, null nếu xong
  ```

- [ ] **Step 1: Viết test thất bại**

```ts
const don = (ghiDe: Partial<Order>) =>
  ({ quantity: 5, remaining_quantity: 5, cut_quantity: 0, ...ghiDe }) as Order;

test("không giảm xuống thấp hơn số đã may", () => {
  // đơn 5 cái, còn 2 → đã may 3
  const r = kepSoCat(don({ remaining_quantity: 2, cut_quantity: 4 }), 1);
  assert.equal(r.cutQuantity, 3);
  assert.equal(r.canhBao, "Đã may 3 cái rồi, không ghi cắt ít hơn được.");
});

test("cắt quá số đơn thì vẫn ghi nhưng báo cắt dư", () => {
  const r = kepSoCat(don({ quantity: 5, cut_quantity: 5 }), 7);
  assert.equal(r.cutQuantity, 7);
  assert.equal(r.catDu, true);
});

test("số may được = đã cắt trừ đã may", () => {
  assert.equal(
    soMayDuoc(don({ quantity: 5, remaining_quantity: 4, cut_quantity: 3 })),
    2,
  );
});

test("số may được không bao giờ âm", () => {
  assert.equal(
    soMayDuoc(don({ quantity: 5, remaining_quantity: 1, cut_quantity: 2 })),
    0,
  );
});

test("tổng chưa cắt bỏ qua đơn đã cắt đủ và đơn cắt dư", () => {
  assert.equal(
    tongChuaCat([
      don({ quantity: 5, cut_quantity: 3 }),
      don({ quantity: 4, cut_quantity: 9 }),
    ]),
    2,
  );
});

test("thiếu cột cut_quantity (chưa chạy migration) thì coi như 0, không NaN", () => {
  const r = kepSoCat({ quantity: 5, remaining_quantity: 5 } as Order, 2);
  assert.equal(r.cutQuantity, 2);
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: Viết `src/lib/cat.ts` và `ghiSoCat`**

`ghiSoCat` ghi một dòng `cutting_logs` rồi `update` `orders.cut_quantity`. Lỗi "column does not exist" trả thông báo "Chưa chạy cập nhật cơ sở dữ liệu." thay vì ném.

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Thêm thanh tiến độ vào thẻ đơn (cả hai vai trò)**

Dòng `✂️ Đã cắt N/M · 🧵 Đã may N/M` kèm thanh ba màu: xanh `#2E7D32` phần đã may, cam `#FB8C00` phần đã cắt chưa may, nền xám `#ECEFF1`. CSS mới trong `src/app/globals.css`. Khi `cut_quantity` không tồn tại (chưa migration) thì **ẩn cả dòng này**.

- [ ] **Step 6: Thêm nút `✂️ Cắt` và bảng số (chỉ admin)**

Nút nằm cùng hàng `order-actions` của admin. Bảng số dựng lại theo đúng khuôn modal "Xong một phần" đang có trong cùng file, thêm hàng nút nhanh `+1 · +2 · +5 · Cắt hết`, viền cam `#EF6C00`.

- [ ] **Step 7: Thêm chế độ "Bàn cắt"**

Nút `✂️` trên thanh tiêu đề màn Đơn hàng bật một cờ trong state; khi bật, danh sách đổi sang một dòng một đơn với bàn tăng/giảm và một nút **Lưu** cho cả lượt. Đơn gấp xếp đầu, đơn đã cắt đủ nền xanh nhạt. Không thêm tab ở `BottomNav`.

- [ ] **Step 8: Thêm nhãn và lời nhắc bên thợ**

Nhãn `MAY ĐƯỢC N CÁI` dùng `soMayDuoc`. Khi thợ ghi số may lớn hơn số đã cắt, hiện hộp nhắc "Đơn này mới cắt N cái — anh chủ chưa ghi, hoặc chị đếm nhầm?" với hai nút _Để xem lại_ / _Vẫn ghi_. **Không chặn.**

- [ ] **Step 9: Kiểm chứng trên trình duyệt**

Run: `npm run build && npm start -- -p 3100`, mở `/don-hang`, ghi cắt 2 cái cho một đơn thật, kiểm tra `cutting_logs` và `orders.cut_quantity`, rồi xoá dòng test.
Expected: thanh tiến độ chuyển đúng, số khớp, bên thợ thấy nhãn mới

- [ ] **Step 10: Commit**

```bash
git add src/lib/cat.ts tests/unit/cat.test.ts src/lib/supabaseService.ts src/app/don-hang/page.tsx src/app/globals.css
git commit -m "feat(cat): ghi so da cat, ban cat, thanh tien do"
```

---

## Task 10: Hai kiểu xem của thợ và báo xong ở chế độ gộp

**Files:**

- Modify: `src/app/don-hang/page.tsx`
- Modify: `src/components/BottomNav.tsx`

**Interfaces:**

- Consumes: `gomTheoMauMa`, `chiaNguocSoLuong` (Task 2–3), `xepHangNhapKho` (Task 8).

- [ ] **Step 1: Thêm dải tổng và chia nhóm theo hạn ở đầu màn của thợ**

Dải tổng ngay đầu màn: **tổng số cái đang cần may**, là chữ to nhất màn hình. Dưới nó chia nhỏ: trễ hạn bao nhiêu cái / hôm nay bao nhiêu cái. Danh sách chia ba nhóm Trễ hạn / Hôm nay / Còn thời gian bằng `xepNhomHan` (Task 15) — nếu Task 15 chưa làm thì viết hàm đó ở đây và Task 15 dùng lại. Đơn được chủ xưởng ghim nằm trên cùng trong nhóm của nó.

- [ ] **Step 1: Thêm cặp nút đổi kiểu xem**

Hai nút _Theo đơn_ / _Gộp theo mẫu mã_ ở đầu màn của thợ. **Mặc định là Gộp theo mẫu mã**; lựa chọn lưu vào `localStorage` khoá `xuong81_kieu_xem`.

- [ ] **Step 2: Dựng thẻ nhóm**

Mỗi nhóm một thẻ: ảnh, `A208 · ĐEN · M`, tổng số cái, `gộp N đơn`, hạn lấy theo `hanGapNhat`, cờ trễ. Bấm vào thẻ xem danh sách đơn bên trong.

- [ ] **Step 3: Báo xong ở chế độ gộp**

Gọi `chiaNguocSoLuong`, rồi **một `production_logs` cho mỗi đơn** (không gộp), **một `batch_id` cho cả lượt**, và một mục nhập kho duy nhất với tổng số.

- [ ] **Step 4: Gỡ tab Nhập sản lượng khỏi app thợ**

`BottomNav` của thợ còn 2 tab: Đơn hàng · Lịch sử. Route `/nhap-san-luong` vẫn còn nhưng chặn `role !== 'admin'` bằng đúng khuôn "Không có quyền" của `bao-cao/page.tsx`.

- [ ] **Step 5: Kiểm chứng chia ngược trên dữ liệu thật**

Tạo 2 đơn cùng mẫu mã (5 cái trễ hạn + 3 cái hạn mai), báo xong 6 ở chế độ gộp, rồi đọc lại.
Expected: đơn trễ đóng hẳn, đơn kia còn 2; đúng 2 dòng `production_logs`; đúng 1 dòng `pancake_stock_ins` với `quantity = 6`

- [ ] **Step 6: Commit**

```bash
git add src/app/don-hang/page.tsx src/components/BottomNav.tsx
git commit -m "feat(tho): hai kieu xem + bao xong o che do gop"
```

---

## Task 11: Màn "Hôm nay" của chủ xưởng

**Files:**

- Create: `src/app/hom-nay/page.tsx`
- Modify: `src/components/BottomNav.tsx`

**Interfaces:**

- Consumes: `tongChuaCat`, `soMayDuoc` (Task 9), `getActiveOrders`, `useAutoRefresh`.

- [ ] **Step 1: Dựng màn**

Theo mục 9 và 9c: khối cam **"Việc cắt của anh"** (tổng chưa cắt + câu "thợ còn N cái đã cắt để may" + nút mở bàn cắt) đặt **trên** khối xanh **"Việc may của thợ"** (tổng cần may + ba số phụ: Pancake đẩy sang / đang may / trễ hạn). Dưới: cảnh báo đơn trễ kèm mã đơn và tên khách, danh sách Pancake vừa đẩy sang, danh sách đã xong hôm nay kèm nhãn `ĐÃ NHẬP KHO PANCAKE`, và danh sách đã cắt hôm nay kèm tổng.

- [ ] **Step 2: Đặt làm tab đầu của chủ xưởng**

`BottomNav` của admin: Hôm nay · Đơn hàng · Đơn thiếu · Sản phẩm · Báo cáo.

- [ ] **Step 3: Chịu được khi chưa chạy migration**

Nếu truy vấn cột mới lỗi, màn vẫn mở và các khối mới tự ẩn.

- [ ] **Step 4: Kiểm chứng**

Run: `npm run build && npm start -- -p 3100`, mở `/hom-nay` với vai admin.
Expected: các con số khớp với `/don-hang`; tắt migration giả lập (đổi tên cột trong truy vấn) vẫn không trắng màn

- [ ] **Step 5: Commit**

```bash
git add src/app/hom-nay/page.tsx src/components/BottomNav.tsx
git commit -m "feat(admin): man Hom nay"
```

---

## Task 12: Màn "Đơn thiếu" + xuất Excel và PDF

**Files:**

- Create: `src/app/don-thieu/page.tsx`
- Create: `src/lib/xuatFile.ts`
- Create: `tests/unit/xuat-file.test.ts`
- Modify: `package.json` (thêm `xlsx`, `pdfmake`)
- Modify: `next.config.js` (thêm `images.remotePatterns` cho `content.pancake.vn`)

**Interfaces:**

- Produces:

  ```ts
  export interface DongDonThieu {
    maDon: string;
    maVanDon: string;
    tenKhach: string;
    soDienThoai: string;
    mauMa: string;
    soLuong: number;
    hanMay: string;
    trangThai: "Chờ may" | "Đang may" | "Xong";
  }
  export function dungDongDonThieu(
    orders: Order[],
    products: Record<string, Product>,
  ): DongDonThieu[];
  export function xuatExcel(dong: DongDonThieu[], tenFile: string): void;
  export function xuatPdf(dong: DongDonThieu[], tieuDe: string): void;
  ```

- [ ] **Step 1: Viết test thất bại cho `dungDongDonThieu`**

```ts
test("đơn chưa đẩy đi thì mã vận đơn để trống, không in chữ null", () => {
  const d = dungDongDonThieu([donMau({ pancake_tracking_code: null })], {});
  assert.equal(d[0].maVanDon, "");
});

test("trạng thái theo số còn lại", () => {
  const d = dungDongDonThieu(
    [
      donMau({ id: "a", quantity: 5, remaining_quantity: 5 }),
      donMau({ id: "b", quantity: 5, remaining_quantity: 2 }),
      donMau({ id: "c", quantity: 5, remaining_quantity: 0, status: "done" }),
    ],
    {},
  );
  assert.deepEqual(
    d.map((x) => x.trangThai),
    ["Chờ may", "Đang may", "Xong"],
  );
});

test("giữ nguyên dấu tiếng Việt trong tên khách", () => {
  const d = dungDongDonThieu(
    [donMau({ pancake_customer_name: "Trần Song Vĩnh Thụy" })],
    {},
  );
  assert.equal(d[0].tenKhach, "Trần Song Vĩnh Thụy");
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: Cài hai gói và viết `dungDongDonThieu`**

Run: `npm install xlsx pdfmake`

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Viết `xuatExcel` và `xuatPdf`**

Excel bằng SheetJS, mỗi cột một ô, tên file `don-thieu-YYYY-MM-DD.xlsx`. PDF bằng **pdfmake** (không dùng jsPDF — font mặc định của jsPDF không in được dấu tiếng Việt), khổ ngang, có tiêu đề ngày và dòng tổng cuối bảng. Cả hai chỉ xuất **đúng những dòng đang hiện trên màn**.

- [ ] **Step 6: Dựng màn Đơn thiếu**

Bảng theo mục 9: mã đơn, mã vận đơn, tên khách, SĐT (bấm gọi được), sản phẩm thiếu kèm ảnh nhỏ, số lượng, hạn may, trạng thái. Chọn ngày ở đầu màn (mặc định hôm nay), lọc nhanh Tất cả / Chờ may / Đã xong, dòng xong **tự tô nền `#E8F5E9` chữ `#2E7D32`** qua `useAutoRefresh`, hai nút Xuất Excel / Xuất PDF. Chỉ admin vào được.

- [ ] **Step 7: Kiểm chứng dấu tiếng Việt trong PDF**

Xuất PDF một ngày có tên khách thật, mở file ra đọc.
Expected: tên hiện đúng dấu, không ra `Trõn Song V?nh Th?y`

- [ ] **Step 8: Commit**

```bash
git add src/app/don-thieu/page.tsx src/lib/xuatFile.ts tests/unit/xuat-file.test.ts package.json package-lock.json next.config.js
git commit -m "feat(admin): man Don thieu + xuat Excel/PDF"
```

---

## Task 13: Màn "Nhập kho Pancake" trong Báo cáo

**Files:**

- Modify: `src/app/bao-cao/page.tsx`

**Interfaces:**

- Consumes: `xaHangDoi`, `danhDauTuNhapTay` (Task 8).

- [ ] **Step 1: Thêm 4 tab con vào Báo cáo**

Tháng · **Nhập kho Pancake** · Nhập SL · Lịch sử.

- [ ] **Step 2: Dựng tab Nhập kho Pancake**

Tổng tháng (bao nhiêu cái, bao nhiêu phiếu, bao nhiêu lỗi), nhật ký theo ngày với mẫu mã / số lượng / số phiếu Pancake. Dòng lỗi nền đỏ kèm lý do Pancake trả về và hai nút: **Thử lại** và **"Tôi đã tự nhập tay"**. Nút thứ hai hỏi xác nhận một lần với đúng câu: _"Chọn cái này nghĩa là chị sẽ tự nhập kho trên Pancake. App sẽ không nhắc lại mẫu này nữa."_

- [ ] **Step 3: Thêm dòng "Đã cắt" vào tab Tháng, phân biệt biểu tượng ở Lịch sử**

Tab Tháng thêm dòng **Đã cắt** cạnh **Đã may** (đọc `cutting_logs`). Lịch sử hiện `✂️` cho dòng cắt, `🧵` cho dòng may.

- [ ] **Step 4: Kiểm chứng**

Tạo một dòng `pancake_stock_ins` giả `status='error'`, mở màn, bấm "Tôi đã tự nhập tay".
Expected: dòng chuyển `skipped`, có hỏi xác nhận; xoá dòng test sau khi xong

- [ ] **Step 5: Commit**

```bash
git add src/app/bao-cao/page.tsx
git commit -m "feat(admin): tab Nhap kho Pancake + dong da cat"
```

---

## Task 14: Tạo đơn chọn mẫu mã Pancake + lọc màn Sản phẩm

**Files:**

- Modify: `src/app/tao-don/page.tsx`
- Modify: `src/app/san-pham/page.tsx`

- [ ] **Step 1: Thêm ô chọn mẫu mã Pancake vào màn Tạo đơn**

Sau khi chọn sản phẩm / màu / size, gợi ý mẫu mã bằng cách dò `pancake_variants` theo tên sản phẩm + màu + size. Chọn được → lưu `pancake_variation_id` và `pancake_sku` vào đơn. Để trống → đơn vẫn tạo bình thường và hiện nhãn **KHÔNG VÀO KHO** trên thẻ đơn.

- [ ] **Step 2: Thêm bộ lọc Của tôi / Từ Pancake vào màn Sản phẩm**

Mặc định **Của tôi** (`source` khác `'pancake'`). Shop có ~2.087 sản phẩm Pancake, không được trộn vào danh sách chủ xưởng tự quản.

- [ ] **Step 3: Kiểm chứng**

Tạo một đơn tay có chọn mẫu mã Pancake, báo xong, rồi đọc `pancake_stock_ins`.
Expected: có dòng nhập kho cho đơn tự tạo; đơn để trống mẫu mã thì không có dòng nào và thẻ hiện nhãn KHÔNG VÀO KHO

- [ ] **Step 4: Commit**

```bash
git add src/app/tao-don/page.tsx src/app/san-pham/page.tsx
git commit -m "feat(admin): chon mau ma Pancake khi tao don + loc san pham"
```

---

## Task 15: Bộ hẹn giờ, nhắc nhở, chống Supabase ngủ

**Files:**

- Create: `src/app/api/cron/nhac-nho/route.ts`
- Create: `src/app/api/cron/dong-bo-mau-ma/route.ts`
- Create: `src/app/api/cron/keep-alive/route.ts`
- Create: `.github/workflows/hen-gio.yml`
- Create: `vercel.json`
- Create: `src/lib/nhacNho.ts`
- Create: `tests/unit/nhac-nho.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export type NhomHan = "tre" | "hom-nay" | "con-thoi-gian";
  export function xepNhomHan(don: Order, homNay: string): NhomHan;
  export function dungLoiNhac(
    dons: Order[],
    homNay: string,
    buoi: "sang" | "chieu",
  ): { tieuDe: string; noiDung: string } | null; // null = im lặng
  ```

- [ ] **Step 1: Viết test thất bại**

```ts
test("buổi chiều im lặng khi không còn đơn trễ hay đơn hôm nay", () => {
  assert.equal(
    dungLoiNhac([donMau({ due_date: "2026-10-30" })], "2026-10-27", "chieu"),
    null,
  );
});

test("buổi sáng vẫn nhắc dù không có đơn gấp", () => {
  assert.notEqual(
    dungLoiNhac([donMau({ due_date: "2026-10-30" })], "2026-10-27", "sang"),
    null,
  );
});

test("xếp nhóm theo hạn", () => {
  assert.equal(
    xepNhomHan(donMau({ due_date: "2026-10-26" }), "2026-10-27"),
    "tre",
  );
  assert.equal(
    xepNhomHan(donMau({ due_date: "2026-10-27" }), "2026-10-27"),
    "hom-nay",
  );
  assert.equal(
    xepNhomHan(donMau({ due_date: null }), "2026-10-27"),
    "con-thoi-gian",
  );
});

test("lời nhắc đếm số cái, không đếm số đơn", () => {
  const r = dungLoiNhac(
    [
      donMau({ due_date: "2026-10-26", remaining_quantity: 5 }),
      donMau({ due_date: "2026-10-26", remaining_quantity: 3 }),
    ],
    "2026-10-27",
    "chieu",
  );
  assert.match(r!.noiDung, /8 cái/);
});
```

- [ ] **Step 2: Chạy test để chắc là nó thất bại**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: Viết `src/lib/nhacNho.ts`**

- [ ] **Step 4: Chạy test để chắc là nó pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Viết ba route cron**

Cả ba chặn bằng header `x-xuong81-secret` khớp `CRON_SECRET`, sai thì `401`. `nhac-nho` nhận `?buoi=sang|chieu`, gọi `dungLoiNhac`, đẩy Web Push cho cả thợ và chủ xưởng qua `/api/send-push`, và buổi sáng kèm các dòng `pancake_stock_ins` còn lỗi. `dong-bo-mau-ma` quét `GET /products/variations` theo trang, ghi vào `pancake_variants`, **đo và in thời gian chạy** — nếu vượt giới hạn hàm Vercel thì chia nhiều lượt bằng tham số `?tu_trang=`. `keep-alive` chạy một truy vấn nhẹ vào Supabase. `dong-bo-mau-ma` còn **đối chiếu lại đơn 24 giờ qua** bằng `GET /orders` rồi nạp vào cùng đường xử lý của Task 7 — webhook không phải đường duy nhất, vì Pancake tự tắt webhook của shop khi URL hỏng.

- [ ] **Step 6: Viết lịch chạy**

`.github/workflows/hen-gio.yml` với 4 lịch UTC: `30 0 * * *` nhắc sáng, `0 7 * * *` nhắc chiều, `0 19 * * *` đồng bộ mẫu mã, `0 5 * * *` keep-alive, cộng một lịch `*/5 * * * *` gọi `/api/pancake/nhap-kho` để xả hàng đợi. Mã bí mật lấy từ GitHub Secrets. `vercel.json` thêm một cron `keep-alive` mỗi ngày làm lớp dự phòng.

- [ ] **Step 7: Thêm lớp xả hàng đợi khi có người mở app**

Trong `src/app/don-hang/page.tsx`, khi vòng làm mới thấy có dòng `pancake_stock_ins` đang `pending`/`error`, gọi route xả hàng đợi (tối đa 1 lần mỗi 60 giây).

- [ ] **Step 8: Kiểm chứng**

```bash
S=$(grep CRON_SECRET .env.local | cut -d= -f2)
curl -s -o /dev/null -w "%{http_code}\n" "localhost:3100/api/cron/nhac-nho?buoi=chieu"
curl -s "localhost:3100/api/cron/nhac-nho?buoi=chieu" -H "x-xuong81-secret: $S"
curl -s "localhost:3100/api/cron/dong-bo-mau-ma" -H "x-xuong81-secret: $S"
```

Expected: `401` khi thiếu mã; có mã thì trả JSON; đồng bộ in ra số mẫu mã đã ghi và số giây chạy

- [ ] **Step 9: Commit**

```bash
git add src/app/api/cron src/lib/nhacNho.ts tests/unit/nhac-nho.test.ts .github/workflows/hen-gio.yml vercel.json src/app/don-hang/page.tsx
git commit -m "feat(cron): nhac nho 7h30/14h, dong bo mau ma, keep-alive"
```

---

## Task 16: Chạy thử phiếu nhập thật rồi bật thật

**Files:**

- Modify: `.env.local`, biến môi trường trên Vercel
- Create: `scripts/thu-phieu-nhap.mjs`

- [ ] **Step 1: Chạy toàn bộ test và build**

Run: `npm test && npm run build`
Expected: tất cả test PASS, build PASS

- [ ] **Step 2: Báo trước cho chủ xưởng**

Nói rõ: sắp tạo **một** phiếu nhập thật **1 cái** trên shop đang kinh doanh, sẽ đọc tồn kho trước và sau, rồi huỷ ngay. Chờ xác nhận.

- [ ] **Step 3: Chạy thử**

Run: `node scripts/thu-phieu-nhap.mjs`
Script đọc `remain_quantity` của một mẫu mã → tạo phiếu nhập 1 cái → in mã phiếu → đọc lại tồn → `PUT` chuyển trạng thái `2` (Canceled) → đọc tồn lần ba.
Expected: tồn tăng đúng 1 rồi trở lại đúng số ban đầu. **Nếu tồn không trở lại, dừng và báo ngay** — đây là chỗ tài liệu Pancake không chắc chắn.

- [ ] **Step 4: Xác nhận `supplier_products_id` nhận đúng**

Đọc lại phiếu vừa tạo qua API, kiểm tra nhà cung cấp đúng là "Xưởng nhà làm".
Expected: khớp `1842006837`

- [ ] **Step 5: Tắt chế độ tập dượt**

Đổi `PANCAKE_DRY_RUN=0` trong `.env.local` và trên Vercel. Đặt biến môi trường trên Vercel bằng bash, **không** bằng PowerShell (PowerShell thêm CRLF làm hỏng giá trị):

```bash
printf '%s' 'gia-tri' | vercel env add PANCAKE_API_KEY production
```

- [ ] **Step 6: E2E bằng Playwright với dữ liệu thật**

Theo khuôn trong `CLAUDE.md`: build production, `npm start` ở port 3100, chạy file `.mjs` bằng `node`. Kịch bản: đăng nhập vai thợ → thấy danh sách gộp theo mẫu mã → báo xong một phần → kiểm tra `production_logs` và `pancake_stock_ins`; đăng nhập vai admin → ghi số cắt → mở Đơn thiếu → xuất Excel. Dọn sạch đơn/log test sau khi xong.

- [ ] **Step 7: Bàn giao phần chủ xưởng phải tự làm**

Ba việc, viết thành danh sách rõ ràng: dán `supabase-pancake.sql` (đã làm ở Task 4); điền Webhook URL `https://xuong-81-ho-van-hue.vercel.app/api/pancake/webhook` và ô **Headers** `x-xuong81-secret: <mã>` trong Pancake; đặt GitHub Secrets cho workflow.

- [ ] **Step 8: Đẩy lên khi chủ xưởng đồng ý**

Lần đẩy này mang theo cả ~5.000 dòng việc dở từ các phiên trước (màn Sản phẩm, Tạo đơn, Nhập sản lượng, Báo cáo, Lịch sử, CSS) — **phải nói rõ trước khi đẩy**.

```bash
git push origin main:master
```

Expected: Vercel deploy Ready, bundle production chứa thay đổi
