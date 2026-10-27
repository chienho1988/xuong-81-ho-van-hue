import { test } from "node:test";
import assert from "node:assert/strict";
import { kepSoCat, soMayDuoc, tongChuaCat } from "../../src/lib/cat.ts";
import type { Order } from "../../src/lib/mockData.ts";

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
