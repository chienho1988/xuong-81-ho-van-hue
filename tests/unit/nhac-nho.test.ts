import { test } from "node:test";
import assert from "node:assert/strict";
import { xepNhomHan, dungLoiNhac } from "../../src/lib/nhacNho.ts";
import { donMau } from "./_donMau.ts";

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
    xepNhomHan(donMau({ due_date: "2026-10-28" }), "2026-10-27"),
    "con-thoi-gian",
  );
  assert.equal(
    xepNhomHan(donMau({ due_date: null }), "2026-10-27"),
    "con-thoi-gian",
  );
});

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

test("lời nhắc đếm số cái, không đếm số đơn", () => {
  const r = dungLoiNhac(
    [
      donMau({ id: "a", due_date: "2026-10-26", remaining_quantity: 5 }),
      donMau({ id: "b", due_date: "2026-10-26", remaining_quantity: 3 }),
    ],
    "2026-10-27",
    "chieu",
  );
  assert.match(r!.noiDung, /8 cái/);
});

test("không có đơn nào thì buổi sáng cũng im lặng", () => {
  assert.equal(dungLoiNhac([], "2026-10-27", "sang"), null);
});
