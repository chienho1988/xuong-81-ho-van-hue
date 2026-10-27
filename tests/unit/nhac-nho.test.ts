import { test } from "node:test";
import assert from "node:assert/strict";
import { xepNhomHan } from "../../src/lib/nhacNho.ts";
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
