import { test } from "node:test";
import assert from "node:assert/strict";
import {
  locMauMaCanMay,
  soLuongTheoMauMa,
} from "../../src/lib/pancake/quyetDinh.ts";

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

test("đếm số cái của từng mẫu mã trong đơn", () => {
  assert.deepEqual(
    soLuongTheoMauMa({
      id: "1",
      status: 0,
      items: [
        { variation_id: "a", quantity: 1 },
        { variation_id: "b", quantity: 1 },
      ],
    }),
    { a: 1, b: 1 },
  );
});

test("cùng một mẫu mã nằm trên nhiều dòng thì cộng lại", () => {
  assert.deepEqual(
    soLuongTheoMauMa({
      id: "1",
      status: 0,
      items: [
        { variation_id: "a", quantity: 2 },
        { variation_id: "a", quantity: 3 },
      ],
    }),
    { a: 5 },
  );
});

test("đơn không có items thì trả về rỗng, không đổ", () => {
  assert.deepEqual(soLuongTheoMauMa({ id: "1", status: 0 } as any), {});
});
