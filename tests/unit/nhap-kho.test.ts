import { test } from "node:test";
import assert from "node:assert/strict";
import { sinhBatchId, gomMucNhapKho } from "../../src/lib/pancake/nhapKho.ts";

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
