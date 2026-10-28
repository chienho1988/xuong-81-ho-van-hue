import { test } from "node:test";
import assert from "node:assert/strict";
import {
  khoaConHan,
  batchIdChoLog,
  logChuaVaoKho,
  motMauMaDuyNhat,
} from "../../src/lib/pancake/doiSoat.ts";

// ── Khoá chống hai luồng cùng chạy ──────────────────────────────
test("khoá còn hạn thì luồng khác phải đứng ngoài", () => {
  assert.equal(
    khoaConHan("2026-10-28T10:00:30Z", "2026-10-28T10:00:00Z"),
    true,
  );
});

test("khoá hết hạn thì luồng khác giành được", () => {
  assert.equal(
    khoaConHan("2026-10-28T09:59:00Z", "2026-10-28T10:00:00Z"),
    false,
  );
});

test("không có khoá thì coi như rảnh", () => {
  assert.equal(khoaConHan(null, "2026-10-28T10:00:00Z"), false);
});

// ── Mã lượt nhập kho suy ra từ dòng sản lượng ───────────────────
test("cùng một dòng sản lượng luôn ra cùng một mã lượt", () => {
  assert.equal(batchIdChoLog("log_123"), batchIdChoLog("log_123"));
});

test("hai dòng sản lượng khác nhau ra hai mã lượt khác nhau", () => {
  assert.notEqual(batchIdChoLog("log_123"), batchIdChoLog("log_124"));
});

// ── Lượt đối soát: dòng sản lượng nào chưa vào kho ──────────────
test("bỏ qua dòng đã nằm trong bảng nối", () => {
  const con = logChuaVaoKho(
    [
      { id: "l1", order_id: "o1" },
      { id: "l2", order_id: "o2" },
    ],
    new Set(["l1"]),
    { o1: "v1", o2: "v2" },
  );
  assert.deepEqual(
    con.map((x) => x.id),
    ["l2"],
  );
});

test("bỏ qua dòng của đơn không gắn mẫu mã Pancake — hàng đó không có đường vào kho", () => {
  const con = logChuaVaoKho(
    [
      { id: "l1", order_id: "o1" },
      { id: "l2", order_id: "o2" },
    ],
    new Set(),
    { o1: "v1", o2: null },
  );
  assert.deepEqual(
    con.map((x) => x.id),
    ["l1"],
  );
});

test("bỏ qua dòng ghi bù không gắn đơn nào", () => {
  const con = logChuaVaoKho([{ id: "l1", order_id: null }], new Set(), {});
  assert.deepEqual(con, []);
});

// ── Một lượt nhập kho chỉ được gồm một mẫu mã ───────────────────
test("mọi dòng cùng một mẫu mã thì trả về mẫu mã đó", () => {
  assert.equal(motMauMaDuyNhat(["v1", "v1", "v1"]), "v1");
});

test("lẫn hai mẫu mã thì từ chối, không đoán", () => {
  assert.equal(motMauMaDuyNhat(["v1", "v2"]), null);
});

test("có dòng không tra ra mẫu mã thì từ chối cả lượt", () => {
  assert.equal(motMauMaDuyNhat(["v1", null]), null);
});

test("danh sách rỗng thì từ chối", () => {
  assert.equal(motMauMaDuyNhat([]), null);
});
