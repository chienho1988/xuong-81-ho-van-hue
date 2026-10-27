// Chạy thử MỘT phiếu nhập kho THẬT đúng 1 cái trên shop đang kinh doanh, rồi huỷ
// ngay (Task 16 của kế hoạch 2026-10-27, chủ xưởng đã đồng ý).
//
// Đọc tồn trước → tạo phiếu → đọc tồn → huỷ phiếu → đọc tồn lần ba.
// Nếu tồn KHÔNG trở lại đúng số ban đầu thì dừng và báo: tài liệu Pancake không
// nói chắc chuyện huỷ phiếu có hoàn tồn hay không, phải tự mắt thấy mới tin.
//
// Chạy: node scripts/thu-phieu-nhap.mjs [variation_id]
// Script này gọi thẳng API, KHÔNG đi qua công tắc PANCAKE_DRY_RUN — vì đây chính
// là lượt chạy thật có chủ ý.

import { readFileSync } from "node:fs";

const SHOP_ID = "970675";
const WAREHOUSE_ID = "c4f2c739-a5a9-4f36-911f-26323b6a21cd";
const SUPPLIER_ID = 1842006837;
const GOC = "https://pos.pages.fm/api/v1";

function docEnv() {
  const env = {};
  for (const dong of readFileSync(".env.local", "utf8").split("\n")) {
    const s = dong.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0) env[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return env;
}

const KEY = docEnv().PANCAKE_API_KEY;
if (!KEY) {
  console.error("THIẾU PANCAKE_API_KEY trong .env.local");
  process.exit(1);
}

async function goi(duongDan, init) {
  const url = `${GOC}${duongDan}${duongDan.includes("?") ? "&" : "?"}api_key=${KEY}`;
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const chu = await res.text();
  let json = null;
  try {
    json = chu ? JSON.parse(chu) : null;
  } catch {
    /* Pancake trả HTML khi lỗi hạ tầng */
  }
  return { ok: res.ok, status: res.status, json, chu };
}

async function docTon(variationId) {
  const r = await goi(
    `/shops/${SHOP_ID}/products/variations?variation_ids[]=${encodeURIComponent(variationId)}`,
  );
  const v = r.json?.data?.[0];
  const kho = (v?.variations_warehouses ?? []).find(
    (w) => w.warehouse_id === WAREHOUSE_ID,
  );
  return {
    ton: kho?.remain_quantity ?? v?.remain_quantity ?? null,
    displayId: v?.display_id,
    nhaCungCap: (v?.product?.supplier_product_ids ?? []).map(String),
  };
}

const variationId = process.argv[2] || "5013d4f3-12b7-43d4-8612-ae517fac2eb6";

console.log("=== CHẠY THỬ PHIẾU NHẬP KHO THẬT — 1 CÁI, HUỶ NGAY ===\n");

const truoc = await docTon(variationId);
if (truoc.ton === null) {
  console.error("Không đọc được tồn kho. Dừng.");
  process.exit(1);
}
console.log(`Mẫu mã:        ${truoc.displayId} (${variationId})`);
console.log(`Nhà cung cấp:  ${truoc.nhaCungCap.join(", ")}`);
if (!truoc.nhaCungCap.includes(String(SUPPLIER_ID))) {
  console.error("Mẫu này KHÔNG thuộc Xưởng nhà làm. Dừng để khỏi nhập nhầm.");
  process.exit(1);
}
console.log(`Tồn TRƯỚC:     ${truoc.ton}\n`);

const payload = {
  purchase: {
    warehouse_id: WAREHOUSE_ID,
    status: 1,
    supplier_products_id: SUPPLIER_ID,
    not_create_transaction: true,
    auto_create_debts: false,
    note: "Xưởng 81 — phiếu chạy thử, huỷ ngay sau khi kiểm",
    items: [
      {
        variation_id: variationId,
        quantity: 1,
        imported_price: 0,
        gross_price: 0,
        discount: 0,
        index: 0,
      },
    ],
  },
};

const tao = await goi(`/shops/${SHOP_ID}/purchases`, {
  method: "POST",
  body: JSON.stringify(payload),
});

if (!tao.ok) {
  console.error(`TẠO PHIẾU HỎNG (${tao.status}): ${tao.chu.slice(0, 500)}`);
  process.exit(1);
}

const phieu = tao.json?.data ?? tao.json;
const phieuId = phieu?.id;
console.log(`Đã tạo phiếu:  id=${phieuId} · mã=${phieu?.display_id ?? "—"}`);
console.log(
  `Nhà cung cấp trên phiếu: ${phieu?.supplier_products_id ?? phieu?.supplier?.id ?? "—"}\n`,
);

await new Promise((r) => setTimeout(r, 2500));
const sau = await docTon(variationId);
console.log(`Tồn SAU khi nhập: ${sau.ton}  (mong đợi ${truoc.ton + 1})`);

if (!phieuId) {
  console.error("\nKHÔNG CÓ id PHIẾU ĐỂ HUỶ. Vào Pancake huỷ tay ngay!");
  process.exit(1);
}

const huy = await goi(`/shops/${SHOP_ID}/purchases/${phieuId}`, {
  method: "PUT",
  body: JSON.stringify({ purchase: { status: 2 } }),
});
console.log(
  `\nHuỷ phiếu:     ${huy.ok ? "đã gửi lệnh huỷ" : `HỎNG ${huy.status} ${huy.chu.slice(0, 300)}`}`,
);

await new Promise((r) => setTimeout(r, 2500));
const cuoi = await docTon(variationId);
console.log(`Tồn SAU khi huỷ: ${cuoi.ton}  (mong đợi ${truoc.ton})\n`);

const tangDung = sau.ton === truoc.ton + 1;
const traLaiDung = cuoi.ton === truoc.ton;

console.log("=== KẾT LUẬN ===");
console.log(
  `Nhập 1 cái làm tồn tăng đúng 1:        ${tangDung ? "ĐÚNG" : "SAI"}`,
);
console.log(
  `Huỷ phiếu trả tồn về đúng số ban đầu:  ${traLaiDung ? "ĐÚNG" : "SAI"}`,
);
if (!traLaiDung) {
  console.log(
    `\n⚠️  TỒN KHÔNG TRỞ LẠI. Phiếu id=${phieuId} cần kiểm tay trên Pancake.`,
  );
  process.exit(2);
}
console.log("\nAn toàn để bật chạy thật.");
