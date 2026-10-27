// Hằng số của shop và khuôn phiếu nhập kho gửi sang Pancake (mục 3 và 5 của thiết kế).
//
// Ba hằng số dưới đây đã xác minh bằng API thật ngày 27/10/2026: shop chỉ có đúng
// một kho và đúng một nhà cung cấp, nên app không bao giờ phải đoán nhập vào đâu.
//
// File này không import gì để chạy được thẳng bằng bộ chạy test của Node.

export const SHOP_ID = "970675";
export const WAREHOUSE_ID = "c4f2c739-a5a9-4f36-911f-26323b6a21cd";
export const SUPPLIER_ID = 1842006837;

export interface MucNhapKho {
  variation_id: string;
  quantity: number;
}

/**
 * Khuôn phiếu nhập kho "Đã nhập hàng" (status 1 — tồn tăng ngay).
 *
 * imported_price 0 là chủ xưởng chọn: hàng tự làm, không mua của ai. Đổi sang giá
 * vốn hay bảng giá công may thì sửa đúng ba số 0 ở đây (mục 10 của thiết kế).
 * not_create_transaction + auto_create_debts false để Pancake không sinh phiếu thu
 * chi hay công nợ.
 */
export function dungPayloadNhapKho(items: MucNhapKho[], note: string) {
  return {
    purchase: {
      warehouse_id: WAREHOUSE_ID,
      status: 1,
      supplier_products_id: SUPPLIER_ID,
      not_create_transaction: true,
      auto_create_debts: false,
      note,
      items: items.map((m, index) => ({
        variation_id: m.variation_id,
        quantity: m.quantity,
        imported_price: 0,
        gross_price: 0,
        discount: 0,
        index,
      })),
    },
  };
}
