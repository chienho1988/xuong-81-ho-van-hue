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
