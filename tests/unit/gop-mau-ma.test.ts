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
