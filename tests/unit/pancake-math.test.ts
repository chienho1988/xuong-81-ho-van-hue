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
