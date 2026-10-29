import { test } from "node:test";
import assert from "node:assert/strict";
import { laEventDon, nhatVariationIds } from "../../src/lib/pancake/tonKho.ts";

test("gói có items kèm variation_id là đơn hàng", () => {
  assert.equal(
    laEventDon({ id: 67645, items: [{ variation_id: "v-1", quantity: 1 }] }),
    true,
  );
});

test("gói tồn kho không có items thì không phải đơn", () => {
  assert.equal(laEventDon({ variation_id: "v-1", remain_quantity: 3 }), false);
});

test("gói rỗng, null, chuỗi đều không phải đơn", () => {
  assert.equal(laEventDon(null), false);
  assert.equal(laEventDon({}), false);
  assert.equal(laEventDon("xin chào"), false);
  assert.equal(laEventDon({ id: 1, items: [] }), false);
  assert.equal(laEventDon({ id: 1, items: [{ quantity: 2 }] }), false);
});

test("nhặt mẫu mã ở mọi tầng của gói", () => {
  const ids = nhatVariationIds({
    variation_id: "v-ngoai",
    data: { items: [{ variation_id: "v-trong" }, { variation_id: "v-hai" }] },
    variation_ids: ["v-ba", 7],
  });
  assert.deepEqual(ids.sort(), ["v-ba", "v-hai", "v-ngoai", "v-trong"]);
});

test("gói không có mẫu mã nào thì trả mảng rỗng, không ném", () => {
  assert.deepEqual(nhatVariationIds({ a: 1, b: "x", c: null }), []);
  assert.deepEqual(nhatVariationIds(null), []);
});

test("gói lồng quá sâu thì dừng, không chạy vô tận", () => {
  const sau: any = {};
  let n = sau;
  for (let i = 0; i < 12; i++) {
    n.trong = {};
    n = n.trong;
  }
  n.variation_id = "v-that-sau";
  assert.deepEqual(nhatVariationIds(sau), []);
});
