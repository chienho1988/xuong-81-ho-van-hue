/**
 * Service layer thay thế toàn bộ localStorage
 * Dùng Supabase làm database backend
 */
import { supabase } from "./supabaseClient";
import type {
  User,
  Category,
  Product,
  ProductVariant,
  Order,
  ProductionLog,
} from "./mockData";

// ============================================================
// USERS
// ============================================================
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase.from("users").select("*");
  if (error) throw error;
  return data || [];
}

export async function getUserByPin(pin: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("pin", pin.trim())
    .single();
  if (error) return null;
  return data;
}

// Đổi mã PIN của một người dùng.
// Trả về thông báo lỗi (tiếng Việt) nếu không đổi được, null nếu thành công.
// PIN phải là duy nhất trong bảng users: getUserByPin dùng .single(), nên hai
// người trùng PIN sẽ làm cả hai không đăng nhập được.
export async function updateUserPin(
  userId: string,
  newPin: string,
): Promise<string | null> {
  const pin = newPin.trim();
  if (!/^\d{4,6}$/.test(pin)) return "Mã PIN phải là 4–6 chữ số.";

  const { data: taken, error: checkError } = await supabase
    .from("users")
    .select("id")
    .eq("pin", pin)
    .neq("id", userId);
  if (checkError) return "Không kiểm tra được mã PIN. Thử lại.";
  if (taken && taken.length > 0) return "Mã PIN này đã có người dùng rồi.";

  const { error } = await supabase
    .from("users")
    .update({ pin })
    .eq("id", userId);
  if (error) return "Không lưu được mã PIN. Thử lại.";
  return null;
}

// ============================================================
// CATEGORIES
// ============================================================
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

// ============================================================
// PRODUCTS (kèm variants)
// ============================================================
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*");
  if (error) throw error;
  const products = data || [];

  // Gắn variants cho từng product
  for (const product of products) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id);
    product.variants = variants || [];
    product.colors = product.colors || [];
    product.sizes = product.sizes || [];
  }

  return products;
}

export async function getProductsByCategory(
  categoryId: string,
): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.category_id === categoryId && p.active);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", data.id);
  data.variants = variants || [];
  data.colors = data.colors || [];
  data.sizes = data.sizes || [];

  return data;
}

export async function saveProduct(product: Product): Promise<void> {
  const { variants, ...productData } = product;

  const { error } = await supabase.from("products").upsert({
    ...productData,
    colors: product.colors || [],
    sizes: product.sizes || [],
  });
  if (error) throw error;

  // Upsert variants (phải gắn product_id vì kiểu ProductVariant không có sẵn)
  if (variants && variants.length > 0) {
    const { error: vErr } = await supabase
      .from("product_variants")
      .upsert(variants.map((v) => ({ ...v, product_id: product.id })));
    if (vErr) throw vErr;
  }
}

export async function saveProducts(products: Product[]): Promise<void> {
  for (const p of products) {
    await saveProduct(p);
  }
}

// ============================================================
// ORDERS
// ============================================================
export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getActiveOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveOrders(orders: Order[]): Promise<void> {
  if (orders.length === 0) return;
  await supabase.from("orders").upsert(orders);
}

export async function addOrder(order: Order): Promise<void> {
  await supabase.from("orders").insert(order);
}

export async function updateOrder(
  id: string,
  updates: Partial<Order>,
): Promise<void> {
  await supabase.from("orders").update(updates).eq("id", id);
}

// ============================================================
// PRODUCTION LOGS
// ============================================================
export async function getProductionLogs(): Promise<ProductionLog[]> {
  const { data, error } = await supabase
    .from("production_logs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addProductionLog(log: ProductionLog): Promise<void> {
  await supabase.from("production_logs").insert(log);
}

export async function addMultipleProductionLogs(
  logs: ProductionLog[],
): Promise<void> {
  if (logs.length === 0) return;
  await supabase.from("production_logs").insert(logs);
}

export async function saveProductionLogs(logs: ProductionLog[]): Promise<void> {
  if (logs.length === 0) return;
  await supabase.from("production_logs").upsert(logs);
}

// ============================================================
// SỔ CẮT (mục 9c của thiết kế)
// Tách hẳn khỏi production_logs: mọi báo cáo và màn Lịch sử đang có đều đọc
// production_logs, thêm cột stage vào đó thì sót một chỗ lọc là cộng đôi sản lượng.
// ============================================================

/**
 * Ghi thêm số cái vừa cắt cho một đơn.
 * Trả thông báo lỗi tiếng Việt, hoặc null khi xong.
 */
export async function ghiSoCat(
  don: Order,
  soCatThem: number,
  nguoiGhi: string,
): Promise<string | null> {
  if (!Number.isFinite(soCatThem) || soCatThem === 0) return null;

  const { kepSoCat } = await import("./cat");
  const ketQua = kepSoCat(don, (don.cut_quantity ?? 0) + soCatThem);
  const thucTe = ketQua.cutQuantity - (don.cut_quantity ?? 0);

  if (thucTe !== 0) {
    const { error } = await supabase.from("cutting_logs").insert({
      order_id: don.id,
      product_id: don.product_id,
      quantity: thucTe,
      created_by: nguoiGhi,
      created_at: new Date().toISOString(),
    });
    if (error) {
      return error.message.includes("does not exist")
        ? "Chưa chạy cập nhật cơ sở dữ liệu."
        : "Không ghi được sổ cắt. Thử lại.";
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({ cut_quantity: ketQua.cutQuantity })
    .eq("id", don.id);
  if (error) {
    return error.message.includes("does not exist")
      ? "Chưa chạy cập nhật cơ sở dữ liệu."
      : "Không lưu được số đã cắt. Thử lại.";
  }

  return ketQua.canhBao;
}

/** Các dòng cắt trong một ngày (YYYY-MM-DD), mới nhất trước. */
export async function getCuttingLogsByDate(ngay: string) {
  const { data, error } = await supabase
    .from("cutting_logs")
    .select("*")
    .gte("created_at", `${ngay}T00:00:00`)
    .lte("created_at", `${ngay}T23:59:59`)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}
