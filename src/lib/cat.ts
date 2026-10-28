// Theo dõi số đã cắt của từng đơn (mục 9c của thiết kế).
//
// Ba con số của một đơn luôn theo thứ tự:
//   quantity (đặt) ≥ cut_quantity (đã cắt) ≥ đã may (quantity − remaining_quantity)
//
// Thuần, không mạng — phần ghi xuống Supabase nằm ở supabaseService.ts.

import type { Order } from "./mockData.ts";

export interface KetQuaKepCat {
  /** Giá trị cut_quantity mới, đã kẹp. */
  cutQuantity: number;
  /** Đã cắt nhiều hơn số đơn đặt. */
  catDu: boolean;
  /** Câu nhắc cho chủ xưởng, null khi không có gì phải nhắc. */
  canhBao: string | null;
}

/** Số cái đã may xong của một đơn. */
export function soDaMay(don: Order): number {
  return Math.max(0, (don.quantity ?? 0) - (don.remaining_quantity ?? 0));
}

/**
 * Kẹp một giá trị "đã cắt" mới cho hợp lệ.
 * `soMoi` là TỔNG số đã cắt, không phải số cắt thêm.
 */
export function kepSoCat(don: Order, soMoi: number): KetQuaKepCat {
  const daMay = soDaMay(don);
  const quantity = don.quantity ?? 0;

  // Hàng đã may thì chắc chắn đã cắt — không cho ghi thấp hơn.
  if (soMoi < daMay) {
    return {
      cutQuantity: daMay,
      catDu: daMay > quantity,
      canhBao: `Đã may ${daMay} cái rồi, không ghi cắt ít hơn được.`,
    };
  }

  const cutQuantity = Math.max(0, Math.round(soMoi));
  return {
    cutQuantity,
    catDu: cutQuantity > quantity,
    canhBao: null,
  };
}

/** Số cái đã cắt sẵn mà thợ còn may được. */
export function soMayDuoc(don: Order): number {
  return Math.max(0, (don.cut_quantity ?? 0) - soDaMay(don));
}

/** Tổng số cái chưa cắt của một danh sách đơn. Đơn cắt dư tính là 0. */
export function tongChuaCat(dons: Order[]): number {
  return dons.reduce(
    (t, d) => t + Math.max(0, (d.quantity ?? 0) - (d.cut_quantity ?? 0)),
    0,
  );
}

export interface PhanChiaCat {
  order_id: string;
  quantity: number;
}

/**
 * Chia số vừa cắt về từng đơn, khi chủ xưởng cắt theo MẪU MÃ chứ không theo đơn.
 *
 * Cùng thứ tự ưu tiên với lúc thợ báo xong ở chế độ gộp: đơn trễ hạn trước, rồi
 * đơn hạn gần nhất, rồi đơn tạo sớm hơn. Mỗi đơn chỉ nhận phần CHƯA CẮT của nó.
 */
export function chiaSoCat(
  dons: Order[],
  soCat: number,
  homNay: string,
): PhanChiaCat[] {
  const treHan = (d: Order) => !!d.due_date && d.due_date < homNay;

  const xep = [...dons].sort((a, b) => {
    const at = treHan(a);
    const bt = treHan(b);
    if (at !== bt) return at ? -1 : 1;
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return (a.created_at || "") < (b.created_at || "") ? -1 : 1;
  });

  const ketQua: PhanChiaCat[] = [];
  let conLai = soCat;

  for (const don of xep) {
    if (conLai <= 0) break;
    const chuaCat = Math.max(0, (don.quantity ?? 0) - (don.cut_quantity ?? 0));
    const nhan = Math.min(conLai, chuaCat);
    if (nhan <= 0) continue;
    ketQua.push({ order_id: don.id, quantity: nhan });
    conLai -= nhan;
  }

  return ketQua;
}
