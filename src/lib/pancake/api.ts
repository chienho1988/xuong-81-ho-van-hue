// Gọi Pancake POS. CHỈ dùng ở route server — PANCAKE_API_KEY không có tiền tố
// NEXT_PUBLIC_ nên không bao giờ xuống tới trình duyệt.
//
// Hình dạng dữ liệu dưới đây lấy từ API thật của shop 970675 ngày 27/10/2026.

import {
  SHOP_ID,
  WAREHOUSE_ID,
  dungPayloadNhapKho,
  type MucNhapKho,
} from "./payload.ts";

const GOC = "https://pos.pages.fm/api/v1";

/** Mẫu mã đã rút gọn về đúng những trường app cần, khớp bảng pancake_variants. */
export interface MauMaPancake {
  variation_id: string;
  display_id: string;
  product_id: string;
  product_name: string;
  category_name: string | null;
  color: string;
  size: string;
  image_url: string | null;
  supplier_ids: string[];
  retail_price: number | null;
  remain_quantity: number;
}

export interface DongHangPancake {
  variation_id: string | null;
  quantity: number;
}

export interface DonPancakeDayDu {
  id: string;
  status: number;
  items: DongHangPancake[];
  bill_full_name: string | null;
  bill_phone_number: string | null;
  tracking_code: string | null;
  carrier: string | null;
  updated_at: string | null;
}

/** Bật thì app làm mọi thứ trừ việc ghi thật sang Pancake. */
export function dangTapDuot(): boolean {
  return process.env.PANCAKE_DRY_RUN === "1";
}

function themKhoa(duongDan: string): string {
  const key = process.env.PANCAKE_API_KEY ?? "";
  return `${GOC}${duongDan}${duongDan.includes("?") ? "&" : "?"}api_key=${key}`;
}

async function goi(duongDan: string, init?: RequestInit): Promise<any> {
  const res = await fetch(themKhoa(duongDan), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const chu = await res.text();
  let json: any = null;
  try {
    json = chu ? JSON.parse(chu) : null;
  } catch {
    // Pancake trả HTML khi lỗi hạ tầng — giữ nguyên chuỗi để báo lỗi cho người đọc
  }
  if (!res.ok) {
    throw new Error(`Pancake ${res.status}: ${chu.slice(0, 300)}`);
  }
  return json;
}

function rutGon(v: any): MauMaPancake {
  const truong = (ten: string): string => {
    const f = (v.fields ?? []).find((x: any) => x?.name === ten);
    return f?.value ?? "";
  };
  const khoNha = (v.variations_warehouses ?? []).find(
    (w: any) => w?.warehouse_id === WAREHOUSE_ID,
  );

  return {
    variation_id: String(v.id),
    display_id: v.display_id ?? "",
    product_id: String(v.product_id ?? ""),
    product_name: v.product?.name ?? v.display_id ?? "",
    category_name: v.product?.categories?.[0]?.name ?? null,
    color: truong("Màu"),
    size: truong("Size"),
    image_url: Array.isArray(v.images) && v.images.length ? v.images[0] : null,
    supplier_ids: (v.product?.supplier_product_ids ?? []).map((x: any) =>
      String(x),
    ),
    retail_price: typeof v.retail_price === "number" ? v.retail_price : null,
    // Tồn của kho Khohang 81, không phải tồn cộng gộp mọi kho.
    remain_quantity: khoNha?.remain_quantity ?? v.remain_quantity ?? 0,
  };
}

/** Lấy một hoặc nhiều mẫu mã theo id. Mảng rỗng trả về mảng rỗng, không gọi mạng. */
export async function layMauMa(
  variationIds: string[],
): Promise<MauMaPancake[]> {
  if (!variationIds.length) return [];
  const q = variationIds
    .map((id) => `variation_ids[]=${encodeURIComponent(id)}`)
    .join("&");
  const json = await goi(`/shops/${SHOP_ID}/products/variations?${q}`);
  return (json?.data ?? []).map(rutGon);
}

/** Một trang của toàn bộ danh mục mẫu mã, dùng cho lượt đồng bộ ban đêm. */
export async function layMotTrangMauMa(
  trang: number,
  moiTrang = 50,
): Promise<{ mauMa: MauMaPancake[]; tongSoTrang: number }> {
  const json = await goi(
    `/shops/${SHOP_ID}/products/variations?page_number=${trang}&page_size=${moiTrang}`,
  );
  return {
    mauMa: (json?.data ?? []).map(rutGon),
    tongSoTrang: json?.total_pages ?? 1,
  };
}

/**
 * Tồn hiện tại của mẫu mã tại kho Khohang 81, lấy tươi từ API.
 * Số âm chính là số đang thiếu — Pancake trừ tồn ngay khi đơn được tạo.
 */
export async function layTonKhoTuoi(
  variationId: string,
): Promise<number | null> {
  const ds = await layMauMa([variationId]);
  const v = ds[0];
  // null = KHÔNG ĐỌC ĐƯỢC, khác hẳn 0 = không thiếu. Trả 0 ở đây thì lệnh may
  // biến mất im lặng mỗi khi Pancake chập chờn.
  if (!v || typeof v.remain_quantity !== "number") return null;
  return v.remain_quantity;
}

/** Đổi payload đơn thô của Pancake về đúng những trường app dùng. */
export function chuanHoaDon(d: any): DonPancakeDayDu {
  return {
    id: String(d.id ?? ""),
    status: typeof d.status === "number" ? d.status : -1,
    items: (Array.isArray(d.items) ? d.items : []).map((m: any) => ({
      variation_id: m?.variation_id ? String(m.variation_id) : null,
      quantity: typeof m?.quantity === "number" ? m.quantity : 0,
    })),
    bill_full_name: d.bill_full_name ?? null,
    bill_phone_number: d.bill_phone_number ?? null,
    tracking_code: d.partner?.extend_code ?? null,
    carrier: d.partner?.partner_name ?? null,
    updated_at: d.updated_at ?? null,
  };
}

export type KetQuaNhapKho =
  { ok: true; displayId: string } | { ok: false; loi: string };

/** Tạo phiếu nhập kho. Khi đang tập dượt thì không gọi mạng. */
export async function taoPhieuNhapKho(
  items: MucNhapKho[],
  note: string,
): Promise<KetQuaNhapKho> {
  if (dangTapDuot()) {
    return { ok: true, displayId: "DRY_RUN" };
  }
  try {
    const json = await goi(`/shops/${SHOP_ID}/purchases`, {
      method: "POST",
      body: JSON.stringify(dungPayloadNhapKho(items, note)),
    });
    const d = json?.data ?? json;
    return { ok: true, displayId: String(d?.display_id ?? d?.id ?? "") };
  } catch (e: any) {
    return { ok: false, loi: String(e?.message ?? e) };
  }
}

/** Chuyển một phiếu nhập về trạng thái Huỷ (2). Dùng cho lượt chạy thử. */
export async function huyPhieuNhapKho(purchaseId: string): Promise<boolean> {
  try {
    await goi(`/shops/${SHOP_ID}/purchases/${encodeURIComponent(purchaseId)}`, {
      method: "PUT",
      body: JSON.stringify({ purchase: { status: 2 } }),
    });
    return true;
  } catch {
    return false;
  }
}
