// Khai báo kiểu dữ liệu dùng chung cho cả app.
//
// Tên file là dấu vết của Phase 1, hồi app còn chạy bằng dữ liệu mẫu trong
// localStorage. Từ khi chuyển sang Supabase thì toàn bộ mảng MOCK_* và các hàm
// đọc/ghi localStorage ở đây không còn ai gọi, nên 30/10/2026 đã xoá (478 dòng).
// Giờ file chỉ còn phần khai báo kiểu — 15 chỗ trong app vẫn import từ đây.
export type Role = "admin" | "worker";

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  color: string;
  size: string;
  image_url: string | null;
  current_quantity: number;
  note: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  main_image_url: string | null;
  description: string;
  colors: string[];
  sizes: string[];
  variants: ProductVariant[];
  active: boolean;
  // Ảnh riêng theo màu (key = tên màu). Màu không có ảnh -> fallback main_image_url.
  color_images?: Record<string, string>;

  // Thêm cho bản nối Pancake (mục 8b của thiết kế).
  source?: "manual" | "pancake";
  pancake_product_id?: string | null;
}

export interface Order {
  id: string;
  product_id: string;
  size: string;
  color: string;
  quantity: number;
  remaining_quantity: number;
  priority: "normal" | "urgent";
  status: "pending" | "done";
  due_date: string | null;
  note: string;
  created_by: string;
  completed_at: string | null;
  completed_by: string | null; // tên công nhân hoàn thành
  is_read_by_admin: boolean; // admin đã đọc thông báo chưa
  created_at: string;

  // Các trường thêm cho bản nối Pancake + theo dõi số đã cắt.
  // Tất cả để optional: app phải chạy được cả khi chưa chạy migration.
  cut_quantity?: number; // số cái đã cắt
  source?: "manual" | "pancake";
  pancake_order_id?: string | null;
  pancake_order_display_id?: string | null;
  pancake_customer_name?: string | null;
  pancake_customer_phone?: string | null;
  pancake_tracking_code?: string | null;
  pancake_carrier?: string | null;
  pancake_order_status?: number | null;
  pancake_variation_id?: string | null;
  pancake_sku?: string | null;
  image_url?: string | null;
  surplus_flag?: boolean; // có thể đã may dư vì đơn Pancake bị sửa giảm
}

export interface ProductionLog {
  id: string;
  product_id: string;
  worker_id: string;
  order_id: string | null;
  log_date: string;
  size: string;
  color: string;
  quantity: number;
  note: string;
  created_at: string;
}
