import type { Order } from "./mockData";

// Gộp đơn theo mẫu mã và chia ngược số lượng về từng đơn (mục 9a của bản thiết kế).
//
// File này không import Supabase hay React để chạy được thẳng bằng bộ chạy test
// của Node.

export interface DonDeChia {
  id: string;
  remaining_quantity: number;
  due_date: string | null;
  created_at: string;
}

export interface PhanChia {
  order_id: string;
  quantity: number;
}

/**
 * Thứ tự nhận hàng khi thợ báo xong ở chế độ gộp:
 * đơn trễ hạn trước → rồi đơn có hạn gần nhất → rồi đơn tạo sớm hơn.
 * Đơn không có hạn xếp sau cùng trong nhóm chưa trễ.
 */
export function xepThuTuNhan<T extends DonDeChia>(
  dons: T[],
  homNay: string,
): T[] {
  const treHan = (d: T) => d.due_date !== null && d.due_date < homNay;

  return [...dons].sort((a, b) => {
    const aTre = treHan(a);
    const bTre = treHan(b);
    if (aTre !== bTre) return aTre ? -1 : 1;

    if (a.due_date !== b.due_date) {
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }

    return a.created_at < b.created_at
      ? -1
      : a.created_at > b.created_at
        ? 1
        : 0;
  });
}

/**
 * Chia soBaoXong về từng đơn theo đúng thứ tự trên. Mỗi đơn nhận cho đủ số còn
 * lại của nó rồi mới sang đơn kế tiếp. Đơn nhận 0 cái không có trong kết quả.
 */
export function chiaNguocSoLuong(
  dons: DonDeChia[],
  soBaoXong: number,
  homNay: string,
): PhanChia[] {
  const ketQua: PhanChia[] = [];
  let conLai = soBaoXong;

  for (const don of xepThuTuNhan(dons, homNay)) {
    if (conLai <= 0) break;
    const nhan = Math.min(conLai, don.remaining_quantity);
    if (nhan <= 0) continue;
    ketQua.push({ order_id: don.id, quantity: nhan });
    conLai -= nhan;
  }

  return ketQua;
}

export interface NhomMauMa {
  /** pancake_variation_id, hoặc `${product_id}|${color}|${size}` khi đơn không gắn Pancake. */
  khoa: string;
  product_id: string;
  color: string;
  size: string;
  pancake_variation_id: string | null;
  /** Tổng remaining_quantity của cả nhóm. */
  tongConLai: number;
  soDon: number;
  /** due_date nhỏ nhất trong nhóm; null khi cả nhóm không đơn nào có hạn. */
  hanGapNhat: string | null;
  coDonTre: boolean;
  /** Đã xếp sẵn theo đúng thứ tự chia ngược. */
  dons: Order[];
}

/**
 * Gộp các đơn cùng một mẫu mã thành một thẻ duy nhất cho app thợ.
 * Hạn hiển thị lấy theo đơn gấp nhất trong nhóm (mục 9a của thiết kế).
 */
export function gomTheoMauMa(orders: Order[], homNay: string): NhomMauMa[] {
  const theoKhoa = new Map<string, Order[]>();

  for (const don of orders) {
    const khoa =
      don.pancake_variation_id ??
      `${don.product_id}|${don.color}|${don.size}`;
    const nhom = theoKhoa.get(khoa);
    if (nhom) nhom.push(don);
    else theoKhoa.set(khoa, [don]);
  }

  const ketQua: NhomMauMa[] = [];

  // forEach chứ không for...of: tsconfig của dự án target es5, duyệt Map
  // bằng for...of cần downlevelIteration.
  theoKhoa.forEach((dons, khoa) => {
    const daXep = xepThuTuNhan(dons, homNay);
    const dau = daXep[0];
    const cacHan = daXep
      .map((d) => d.due_date)
      .filter((h): h is string => h !== null);

    ketQua.push({
      khoa,
      product_id: dau.product_id,
      color: dau.color,
      size: dau.size,
      pancake_variation_id: dau.pancake_variation_id ?? null,
      tongConLai: daXep.reduce((t, d) => t + d.remaining_quantity, 0),
      soDon: daXep.length,
      hanGapNhat: cacHan.length ? cacHan.reduce((a, b) => (a < b ? a : b)) : null,
      coDonTre: cacHan.some((h) => h < homNay),
      dons: daXep,
    });
  });

  return ketQua;
}
