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
