import { test } from "node:test";
import assert from "node:assert/strict";
import { dungDongDonThieu } from "../../src/lib/xuatFile.ts";
import { donMau } from "./_donMau.ts";

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
