// Đồng bộ tồn kho Pancake → app, và nhận diện loại event webhook.
//
// Vì sao cần: chủ xưởng bật thêm ba loại dữ liệu cho webhook ngày 29/10 (Tồn kho,
// Sản phẩm, Gọi tự động). Từ lúc đó Pancake bắn sang cả những gói KHÔNG phải đơn
// hàng. Nếu cứ nạp hết vào hàng đợi xử lý đơn thì mỗi gói lạ thành một "đơn rỗng",
// vừa bẩn bảng vừa che mất đơn thật.
//
// Và chuyện chủ xưởng kêu đúng hơn: nhập hàng bằng tay trên Pancake thì app không
// hay biết, lệnh may vẫn nằm đó. Giờ mỗi lần tồn kho đổi, app đọc lại tồn thật rồi
// gắn cờ "có thể không cần may nữa" cho lệnh may đang chờ của mẫu mã đó.
//
// KHÔNG tự xoá lệnh may: thợ có thể đã cắt, đã may dở. Chỉ gắn cờ để chủ xưởng
// quyết — cùng nguyên tắc với luồng A.

import { supabaseServer } from "../supabaseServer.ts";
import { layTonKhoTuoi } from "./api.ts";
import { demDangChoMay, demDangChoNhapKho } from "./xuLyDon.ts";
import { tinhSoCanMay } from "./math.ts";

/** Trần một lượt: một gói webhook không được kéo theo hàng trăm lượt gọi Pancake. */
const TOI_DA_MAU_MA = 20;
/**
 * Lượt quét định kỳ đi được xa hơn, nhưng không được chạm trần 60 giây của hàm
 * Vercel: đo 29/10 là 0,68 giây một mẫu mã, nên 30 mẫu ≈ 20 giây. Route xáo danh
 * sách trước khi cắt nên mẫu mã nào cũng tới lượt sau vài lần chạy.
 */
export const TOI_DA_QUET = 30;
/** Số mẫu mã soi song song một tốp. */
const MOI_TOP = 5;

/**
 * Gói này có phải một đơn hàng không?
 *
 * Dấu hiệu chắc chắn nhất của đơn: có mảng items và ít nhất một dòng có
 * variation_id. Gói tồn kho / sản phẩm / gọi tự động không có hình dạng đó.
 */
export function laEventDon(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (payload.id == null && payload.order_id == null) return false;
  const items = payload.items;
  if (!Array.isArray(items) || !items.length) return false;
  return items.some((m: any) => m && m.variation_id != null);
}

/**
 * Nhặt mọi variation_id nằm trong gói, dù Pancake xếp chúng ở tầng nào.
 *
 * Cố ý dò chung chung: hình dạng gói tồn kho chưa có tài liệu, nên thà nhặt dư
 * vài mã rồi đọc lại tồn (chỉ tốn một lượt gọi) còn hơn bỏ sót mẫu mã vừa nhập.
 */
export function nhatVariationIds(payload: any, sau = 0): string[] {
  if (sau > 4 || !payload || typeof payload !== "object") return [];
  const ra: string[] = [];
  if (Array.isArray(payload)) {
    payload.forEach((x) => ra.push(...nhatVariationIds(x, sau + 1)));
    return ra;
  }
  Object.keys(payload).forEach((khoa) => {
    const giaTri = (payload as any)[khoa];
    if (khoa === "variation_id" && typeof giaTri === "string") ra.push(giaTri);
    else if (khoa === "variation_ids" && Array.isArray(giaTri)) {
      giaTri.forEach((x) => typeof x === "string" && ra.push(x));
    } else if (giaTri && typeof giaTri === "object") {
      ra.push(...nhatVariationIds(giaTri, sau + 1));
    }
  });
  return ra;
}

export interface KetQuaDongBoTon {
  mauMa: number;
  danhDauDu: number;
  boCo: number;
  conLai: number;
}

/**
 * Đọc lại tồn thật của từng mẫu mã rồi chỉnh app theo.
 *
 * Dùng cho cả hai đường: webhook tồn kho bắn sang, và lượt quét định kỳ.
 */
export async function dongBoTonKhoMauMa(
  ids: string[],
  toiDa = TOI_DA_MAU_MA,
): Promise<KetQuaDongBoTon> {
  const ketQua: KetQuaDongBoTon = {
    mauMa: 0,
    danhDauDu: 0,
    boCo: 0,
    conLai: 0,
  };
  const rieng: string[] = [];
  ids.forEach((x) => {
    if (x && rieng.indexOf(x) < 0) rieng.push(x);
  });
  ketQua.conLai = Math.max(0, rieng.length - toiDa);

  // Chạy từng tốp song song: đo trên Vercel 29/10 là 2,2 giây một mẫu mã nếu làm
  // lần lượt, 23 mẫu đã ngốn 50 giây — sát trần 60 giây của hàm. Năm việc một tốp
  // là đủ nhanh mà không dội Pancake.
  const canLam = rieng.slice(0, toiDa);
  for (let i = 0; i < canLam.length; i += MOI_TOP) {
    const top = canLam.slice(i, i + MOI_TOP);
    const phan = await Promise.all(
      top.map((id) => soiMotMauMa(id).catch(() => null)),
    );
    phan.forEach((x) => {
      if (!x) return;
      ketQua.mauMa++;
      ketQua.danhDauDu += x.danhDauDu;
      ketQua.boCo += x.boCo;
    });
  }

  return ketQua;
}

/** Soi đúng một mẫu mã. Trả null khi không đọc được tồn — lượt sau tính lại. */
async function soiMotMauMa(
  variationId: string,
): Promise<{ danhDauDu: number; boCo: number } | null> {
  const phan = { danhDauDu: 0, boCo: 0 };
  const remainQuantity = await layTonKhoTuoi(variationId);
  if (remainQuantity === null) return null;

  await supabaseServer
    .from("product_variants")
    .update({ current_quantity: Math.max(0, remainQuantity) })
    .eq("id", `v_pk_${variationId}`);

  const [dangChoMay, dangChoNhapKho] = await Promise.all([
    demDangChoMay(variationId),
    demDangChoNhapKho(variationId),
  ]);

  const { mayDu } = tinhSoCanMay({
    remainQuantity,
    dangChoMay,
    dangChoNhapKho,
    // Không có đơn nào đang xét: đây là lượt soi riêng tồn kho.
    soLuongDonNay: 0,
    daTaoChoDonNay: 0,
  });

  if (mayDu > 0) {
    const { data } = await supabaseServer
      .from("orders")
      .update({ surplus_flag: true })
      .eq("pancake_variation_id", variationId)
      .eq("status", "pending")
      .select("id");
    phan.danhDauDu = (data ?? []).length;
  } else {
    const { data } = await supabaseServer
      .from("orders")
      .update({ surplus_flag: false })
      .eq("pancake_variation_id", variationId)
      .eq("status", "pending")
      .eq("surplus_flag", true)
      .select("id");
    phan.boCo = (data ?? []).length;
  }

  return phan;
}
