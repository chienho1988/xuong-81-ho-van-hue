// Kiểm tra migration supabase-pancake.sql đã chạy chưa.
// Chạy: node scripts/kiem-tra-migration.mjs
// Thoát mã 0 nếu đủ, 1 nếu còn thiếu.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function docEnvLocal() {
  const env = {};
  try {
    for (const dong of readFileSync(".env.local", "utf8").split("\n")) {
      const sach = dong.trim();
      if (!sach || sach.startsWith("#")) continue;
      const i = sach.indexOf("=");
      if (i > 0) env[sach.slice(0, i).trim()] = sach.slice(i + 1).trim();
    }
  } catch {
    // không có .env.local thì rơi về process.env
  }
  return { ...env, ...process.env };
}

const env = docEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "THIẾU: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  process.exit(1);
}

const supabase = createClient(url, key);

const bangMoi = [
  "pancake_variants",
  "pancake_webhook_events",
  "pancake_stock_ins",
  "pancake_stock_in_logs",
  "cutting_logs",
  // Bản vá 28/10: khoá chống hai luồng cùng gọi Pancake.
  "pancake_locks",
];

const cotMoi = [
  ["orders", "cut_quantity"],
  ["orders", "source"],
  ["orders", "pancake_variation_id"],
  ["orders", "surplus_flag"],
  ["products", "source"],
  ["products", "pancake_product_id"],
  ["pancake_stock_ins", "claimed_at"],
];

let thieu = 0;

for (const bang of bangMoi) {
  const { error } = await supabase.from(bang).select("*").limit(1);
  if (error) {
    thieu++;
    console.log(`THIẾU bảng ${bang}: ${error.message}`);
  } else {
    console.log(`OK   bảng ${bang}`);
  }
}

for (const [bang, cot] of cotMoi) {
  const { error } = await supabase.from(bang).select(cot).limit(1);
  if (error) {
    thieu++;
    console.log(`THIẾU cột ${bang}.${cot}: ${error.message}`);
  } else {
    console.log(`OK   cột ${bang}.${cot}`);
  }
}

if (thieu > 0) {
  console.log(
    `\n>>> Còn thiếu ${thieu} thứ. Dán supabase-pancake.sql VÀ supabase-pancake-sua.sql vào Supabase SQL Editor rồi chạy lại.`,
  );
  process.exit(1);
}

console.log("\n>>> Migration đã chạy đủ.");
