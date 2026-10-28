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
  /**
   * Số cái mẫu mã này trong CHÍNH đơn đang xử lý.
   *
   * Trần cứng: không bao giờ may cho một đơn nhiều hơn số đơn đó cần. Thiếu trần
   * này thì một đơn cần 1 cái mà tồn cả shop đang −8 sẽ ra lệnh may 8 — lỗi thật
   * gặp ngày 28/10 với đơn #67645.
   */
  soLuongDonNay: number;
  /**
   * Số cái ĐÃ tạo lệnh may cho chính đơn Pancake này, của chính mẫu mã này.
   *
   * Pancake bắn webhook MỖI LẦN đơn được sửa — đơn #67639 ngày 28/10 bắn 3 lần —
   * nên nếu không trừ phần đã tạo thì mỗi lần bắn lại đẻ thêm một lệnh may nữa.
   */
  daTaoChoDonNay: number;
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

  // Hai trần: phần cả shop còn thiếu mà chưa ai lo, và số chính đơn này cần.
  const theoShop = Math.max(0, chenh);
  const conThieuCuaDonNay = Math.max(0, s.soLuongDonNay - s.daTaoChoDonNay);
  const canMay = Math.min(theoShop, conThieuCuaDonNay);

  return {
    canMay,
    // "May dư" vẫn tính theo toàn shop, vì nó nói về tồn kho chứ không về một đơn.
    mayDu: Math.max(0, -chenh),
  };
}
