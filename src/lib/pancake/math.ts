// Công thức tính số cần may (mục 4 của bản thiết kế).
//
// Quy tắc một câu: tổng số đang nằm trong các lệnh may chưa xong của một mẫu mã,
// luôn bằng đúng số mà Pancake đang thiếu của mẫu mã đó.
//
// File này không được import gì — không Supabase, không React — để chạy được
// thẳng bằng bộ chạy test của Node.

export interface SoLieuMauMa {
  /** remain_quantity tươi từ Pancake, có thể âm. Âm nghĩa là đang thiếu. */
  remainQuantity: number;
  /** Tổng quantity các lệnh may của mẫu mã này còn status='pending'. */
  dangChoMay: number;
  /**
   * Tổng quantity các phiếu nhập kho của mẫu mã này chưa vào được Pancake:
   * pending / error / skipped. Thiếu vế này thì trong khoảng trống giữa lúc thợ
   * bấm Xong và lúc phiếu nhập kho vào được, app sẽ đẻ thêm một lệnh may trùng.
   */
  dangChoNhapKho: number;
}

export interface KetQuaCanMay {
  /** Số cái cần tạo lệnh may mới. Không bao giờ âm. */
  canMay: number;
  /** Số cái có thể đã may dư (đơn bị huỷ hoặc sửa giảm). Không bao giờ âm. */
  mayDu: number;
}

export function tinhSoCanMay(s: SoLieuMauMa): KetQuaCanMay {
  const thieuHienTai = Math.max(0, -s.remainQuantity);
  const daLoLieu = s.dangChoMay + s.dangChoNhapKho;
  const chenh = thieuHienTai - daLoLieu;

  return {
    canMay: Math.max(0, chenh),
    mayDu: Math.max(0, -chenh),
  };
}
