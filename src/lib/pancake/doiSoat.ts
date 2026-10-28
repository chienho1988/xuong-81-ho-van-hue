// Chống chạy đôi và đối soát hàng đã may nhưng chưa vào kho.
//
// Sinh ra sau vòng soát độc lập 28/10/2026, vốn bắt được bốn chỗ có thể nhập kho
// hai lần hoặc đẻ lệnh may trùng. Phần thuần nằm ở đây để kiểm được bằng test;
// phần chạm database nằm ở nhapKho.ts và xuLyDon.ts.

/** Khoá còn hạn nghĩa là luồng khác đang làm việc đó, mình phải đứng ngoài. */
export function khoaConHan(giuDen: string | null, bayGio: string): boolean {
  if (!giuDen) return false;
  return giuDen > bayGio;
}

/**
 * Mã lượt nhập kho suy ra TẤT ĐỊNH từ dòng sản lượng.
 *
 * Nhờ vậy lượt đối soát chạy lại bao nhiêu lần cũng chỉ ra một phiếu nhập cho một
 * dòng sản lượng — ràng buộc duy nhất trên batch_id tự chặn phần còn lại.
 */
export function batchIdChoLog(logId: string): string {
  return `b_log_${logId}`;
}

export interface DongSanLuong {
  id: string;
  order_id: string | null;
}

/**
 * Lọc ra những dòng sản lượng đã may xong mà CHƯA có đường vào kho Pancake.
 *
 * Bỏ qua: dòng đã nằm trong bảng nối, dòng ghi bù không gắn đơn nào, và dòng của
 * đơn không gắn mẫu mã Pancake (hàng đó vốn không vào kho — nhãn KHÔNG VÀO KHO).
 */
export function logChuaVaoKho(
  logs: DongSanLuong[],
  daCoTrongBang: Set<string>,
  mauMaTheoDon: Record<string, string | null>,
): DongSanLuong[] {
  return logs.filter((l) => {
    if (daCoTrongBang.has(l.id)) return false;
    if (!l.order_id) return false;
    return !!mauMaTheoDon[l.order_id];
  });
}

/**
 * Một phiếu nhập kho chỉ được gồm đúng một mẫu mã. Lẫn hai mẫu, hoặc có dòng không
 * tra ra mẫu mã, thì từ chối cả lượt thay vì đoán — đoán sai là tồn kho sai.
 */
export function motMauMaDuyNhat(dsMauMa: (string | null)[]): string | null {
  if (!dsMauMa.length) return null;
  const dau = dsMauMa[0];
  if (!dau) return null;
  return dsMauMa.every((x) => x === dau) ? dau : null;
}
