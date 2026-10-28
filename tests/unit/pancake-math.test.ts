import { test } from "node:test";
import assert from "node:assert/strict";
import { tinhSoCanMay } from "../../src/lib/pancake/math.ts";

test("thiếu 5 cái, chưa lo gì → may 5", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -5,
      dangChoMay: 0,
      dangChoNhapKho: 0,
      soLuongDonNay: 99,
      daTaoChoDonNay: 0,
    }),
    { canMay: 5, mayDu: 0 },
  );
});

test("thiếu 5 cái, đã có lệnh may 5 → không tạo thêm", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -5,
      dangChoMay: 5,
      dangChoNhapKho: 0,
      soLuongDonNay: 99,
      daTaoChoDonNay: 0,
    }),
    { canMay: 0, mayDu: 0 },
  );
});

test("thợ báo xong rồi nhưng phiếu nhập kho chưa vào → không đẻ lệnh may mới", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -8,
      dangChoMay: 0,
      dangChoNhapKho: 8,
      soLuongDonNay: 99,
      daTaoChoDonNay: 0,
    }),
    { canMay: 0, mayDu: 0 },
  );
});

test("tồn dương → không may", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: 12,
      dangChoMay: 0,
      dangChoNhapKho: 0,
      soLuongDonNay: 99,
      daTaoChoDonNay: 0,
    }),
    { canMay: 0, mayDu: 0 },
  );
});

test("đơn bị huỷ sau khi đã lên lệnh may → báo may dư, không trả số âm", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: 0,
      dangChoMay: 5,
      dangChoNhapKho: 0,
      soLuongDonNay: 99,
      daTaoChoDonNay: 0,
    }),
    { canMay: 0, mayDu: 5 },
  );
});

test("thiếu nhiều hơn phần đã lo → chỉ may đúng phần chênh", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -10,
      dangChoMay: 3,
      dangChoNhapKho: 2,
      soLuongDonNay: 99,
      daTaoChoDonNay: 0,
    }),
    { canMay: 5, mayDu: 0 },
  );
});

test("đơn chỉ cần 1 cái thì may 1, dù cả shop đang thiếu 8", () => {
  // Lỗi thật 28/10: đơn của khách chỉ thiếu 1 cái V38-LOANG-M nhưng tồn cả shop
  // là −8, app ra lệnh may 8 cái. Số may cho MỘT đơn không bao giờ được vượt quá
  // số đơn đó cần.
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -8,
      dangChoMay: 0,
      dangChoNhapKho: 0,
      soLuongDonNay: 1,
      daTaoChoDonNay: 0,
    }),
    { canMay: 1, mayDu: 0 },
  );
});

test("đơn cần 5 nhưng shop chỉ thiếu 2 thì may 2 — ba cái kia còn trong kho", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -2,
      dangChoMay: 0,
      dangChoNhapKho: 0,
      soLuongDonNay: 5,
      daTaoChoDonNay: 0,
    }),
    { canMay: 2, mayDu: 0 },
  );
});

test("phần đã lo liệu vẫn chặn trên, kể cả khi đơn cần nhiều", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -8,
      dangChoMay: 8,
      dangChoNhapKho: 0,
      soLuongDonNay: 5,
      daTaoChoDonNay: 0,
    }),
    { canMay: 0, mayDu: 0 },
  );
});

test("webhook bắn lại cho cùng một đơn thì KHÔNG tạo thêm lệnh may", () => {
  // Lỗi thật 28/10: Pancake gửi 3 lần cho đơn #67639, app tạo 3 lệnh may cho mỗi
  // mẫu mã. Trần theo đơn phải trừ đi phần đã tạo cho chính đơn đó.
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -8,
      dangChoMay: 1,
      dangChoNhapKho: 0,
      soLuongDonNay: 1,
      daTaoChoDonNay: 1,
    }),
    { canMay: 0, mayDu: 0 },
  );
});

test("đơn cần 3 mà mới tạo 1 thì tạo thêm đúng 2", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -8,
      dangChoMay: 1,
      dangChoNhapKho: 0,
      soLuongDonNay: 3,
      daTaoChoDonNay: 1,
    }),
    { canMay: 2, mayDu: 0 },
  );
});

test("đơn sửa giảm sau khi đã tạo nhiều hơn thì không tạo thêm", () => {
  assert.deepEqual(
    tinhSoCanMay({
      remainQuantity: -8,
      dangChoMay: 5,
      dangChoNhapKho: 0,
      soLuongDonNay: 2,
      daTaoChoDonNay: 5,
    }),
    { canMay: 0, mayDu: 0 },
  );
});
