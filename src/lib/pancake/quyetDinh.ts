// Quyết định mẫu mã nào của một đơn Pancake thì xưởng phải may (mục 4 của thiết kế).
//
// Thuần, không mạng, không Supabase — để chạy test thẳng bằng Node.

import { SUPPLIER_ID } from "./payload.ts";

export interface DongHang {
  variation_id: string | null;
  quantity: number;
}

export interface DonPancake {
  id: string;
  status: number;
  items: DongHang[];
}

export type LyDoBoQua =
  | "trang-thai" // đơn đã gửi / đã huỷ / đã hoàn
  | "khong-co-mau-ma" // dòng hàng thiếu variation_id, hoặc tra không ra
  | "khong-phai-xuong-nha"; // nhà cung cấp khác, xưởng không may

export interface MauMaCanXet {
  variation_id: string;
  supplier_ids: string[];
}

export interface BoQua {
  variation_id: string | null;
  lyDo: LyDoBoQua;
}

/** Chỉ xử lý đơn Mới (0) và Đã xác nhận (1). */
const TRANG_THAI_XU_LY = [0, 1];

export function locMauMaCanMay(
  don: DonPancake,
  traCuu: Map<string, MauMaCanXet>,
): { canXet: string[]; boQua: BoQua[] } {
  const items = Array.isArray(don?.items) ? don.items : [];

  if (!TRANG_THAI_XU_LY.includes(don?.status)) {
    return {
      canXet: [],
      boQua: items.length
        ? items.map((m) => ({
            variation_id: m?.variation_id ?? null,
            lyDo: "trang-thai" as const,
          }))
        : [{ variation_id: null, lyDo: "trang-thai" }],
    };
  }

  const canXet: string[] = [];
  const boQua: BoQua[] = [];

  for (const dong of items) {
    const id = dong?.variation_id ?? null;
    if (!id) {
      boQua.push({ variation_id: null, lyDo: "khong-co-mau-ma" });
      continue;
    }

    const mauMa = traCuu.get(id);
    if (!mauMa) {
      boQua.push({ variation_id: id, lyDo: "khong-co-mau-ma" });
      continue;
    }

    if (!mauMa.supplier_ids.includes(String(SUPPLIER_ID))) {
      boQua.push({ variation_id: id, lyDo: "khong-phai-xuong-nha" });
      continue;
    }

    // Cùng một mẫu mã có thể nằm trên nhiều dòng hàng — chỉ xét một lần, vì số
    // cần may tính theo tồn kho chứ không cộng theo dòng.
    if (!canXet.includes(id)) canXet.push(id);
  }

  return { canXet, boQua };
}
