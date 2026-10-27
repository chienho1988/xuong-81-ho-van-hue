// Biến một event webhook của Pancake thành lệnh may trong app (mục 4 và 8b của thiết kế).
//
// Chỉ chạy ở server: dùng supabaseServer và PANCAKE_API_KEY.

import { supabaseServer } from "@/lib/supabaseServer";
import {
  layMauMa,
  layTonKhoTuoi,
  chuanHoaDon,
  type MauMaPancake,
} from "./api.ts";
import { locMauMaCanMay, type MauMaCanXet } from "./quyetDinh.ts";
import { tinhSoCanMay } from "./math.ts";

/** Hạn may mặc định: hôm nay + 2 ngày (chủ xưởng chốt). */
const SO_NGAY_HAN = 2;

function ngayHan(): string {
  return new Date(Date.now() + SO_NGAY_HAN * 86400000)
    .toISOString()
    .split("T")[0];
}

function maNgauNhien(): string {
  return Math.random().toString(36).substring(2, 6);
}

/**
 * Tra mẫu mã trong bảng nội bộ; thiếu cái nào thì gọi Pancake lấy lẻ rồi lưu lại.
 * Trả về map để locMauMaCanMay dùng.
 */
export async function layTraCuu(variationIds: string[]): Promise<{
  traCuu: Map<string, MauMaCanXet>;
  dayDu: Map<string, MauMaPancake>;
}> {
  const traCuu = new Map<string, MauMaCanXet>();
  const dayDu = new Map<string, MauMaPancake>();
  if (!variationIds.length) return { traCuu, dayDu };

  const { data } = await supabaseServer
    .from("pancake_variants")
    .select("*")
    .in("variation_id", variationIds);

  for (const v of data ?? []) {
    traCuu.set(v.variation_id, {
      variation_id: v.variation_id,
      supplier_ids: v.supplier_ids ?? [],
    });
    dayDu.set(v.variation_id, v as MauMaPancake);
  }

  const thieu = variationIds.filter((id) => !traCuu.has(id));
  if (thieu.length) {
    const moi = await layMauMa(thieu);
    if (moi.length) {
      await supabaseServer
        .from("pancake_variants")
        .upsert(
          moi.map((m) => ({ ...m, synced_at: new Date().toISOString() })),
        );
    }
    for (const m of moi) {
      traCuu.set(m.variation_id, {
        variation_id: m.variation_id,
        supplier_ids: m.supplier_ids,
      });
      dayDu.set(m.variation_id, m);
    }
  }

  return { traCuu, dayDu };
}

/**
 * Bảo đảm có một dòng `products` nội bộ cho mẫu mã Pancake này.
 * orders.product_id và production_logs.product_id đều NOT NULL khoá ngoại tới
 * products, nên không có dòng này thì không tạo được lệnh may.
 *
 * Tạo dần theo nhu cầu: shop có ~2.087 sản phẩm, đổ hết vào app là hỏng màn Sản phẩm.
 */
export async function baoDamSanPham(mauMa: MauMaPancake): Promise<string> {
  const { data: daCo } = await supabaseServer
    .from("products")
    .select("id")
    .eq("pancake_product_id", mauMa.product_id)
    .limit(1);
  if (daCo && daCo.length) return daCo[0].id;

  // Danh mục theo đúng tên Pancake để chủ xưởng nhìn là nhận ra.
  const tenDanhMuc = mauMa.category_name ?? "Từ Pancake";
  let categoryId: string | null = null;

  const { data: dm } = await supabaseServer
    .from("categories")
    .select("id")
    .eq("name", tenDanhMuc)
    .limit(1);

  if (dm && dm.length) {
    categoryId = dm[0].id;
  } else {
    categoryId = `c_pk_${Date.now()}_${maNgauNhien()}`;
    const { error } = await supabaseServer.from("categories").insert({
      id: categoryId,
      name: tenDanhMuc,
      icon: "📦",
      color: "#1976D2",
      sort_order: 999,
    });
    if (error) {
      // Danh mục có thể vừa được một lượt khác tạo — tra lại cho chắc.
      const { data: lai } = await supabaseServer
        .from("categories")
        .select("id")
        .eq("name", tenDanhMuc)
        .limit(1);
      categoryId = lai?.[0]?.id ?? categoryId;
    }
  }

  // Id tất định theo product_id của Pancake: gọi lại nhiều lần cũng chỉ một dòng.
  const id = `p_pk_${mauMa.product_id}`;
  const { error } = await supabaseServer.from("products").upsert({
    id,
    category_id: categoryId,
    name: mauMa.product_name,
    main_image_url: mauMa.image_url,
    description: "",
    colors: mauMa.color ? [mauMa.color] : [],
    sizes: mauMa.size ? [mauMa.size] : [],
    active: true,
    source: "pancake",
    pancake_product_id: mauMa.product_id,
  });
  if (error)
    throw new Error(`Không tạo được sản phẩm nội bộ: ${error.message}`);

  return id;
}

/**
 * orders.created_by là KHOÁ NGOẠI tới users(id), không phải tên tự do. Lệnh may do
 * Pancake sinh ra ghi tên chủ xưởng; chỗ phân biệt nguồn là cột `source`.
 * Không tạo một dòng users riêng cho Pancake: mỗi dòng users là một lối đăng nhập
 * bằng mã PIN.
 */
let idChuXuongCache: string | null = null;

async function idChuXuong(): Promise<string> {
  if (idChuXuongCache) return idChuXuongCache;
  const { data } = await supabaseServer
    .from("users")
    .select("id")
    .eq("role", "admin")
    .limit(1);
  const id: string = data?.[0]?.id ?? "u1";
  idChuXuongCache = id;
  return id;
}

/** Tổng số cái của mẫu mã này đang nằm trong các lệnh may chưa xong. */
async function demDangChoMay(variationId: string): Promise<number> {
  const { data } = await supabaseServer
    .from("orders")
    .select("remaining_quantity")
    .eq("pancake_variation_id", variationId)
    .eq("status", "pending");
  return (data ?? []).reduce((t, o: any) => t + (o.remaining_quantity ?? 0), 0);
}

/** Tổng số cái đã may xong nhưng chưa vào được kho Pancake. */
async function demDangChoNhapKho(variationId: string): Promise<number> {
  const { data } = await supabaseServer
    .from("pancake_stock_ins")
    .select("quantity")
    .eq("variation_id", variationId)
    .in("status", ["pending", "error", "skipped"]);
  return (data ?? []).reduce((t, s: any) => t + (s.quantity ?? 0), 0);
}

async function baoChoTho(soCai: number, ten: string, goc: string) {
  try {
    await fetch(new URL("/api/send-push", goc), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "worker",
        title: "Có hàng mới cần may",
        body: `${ten} — ${soCai} cái`,
      }),
    });
  } catch {
    // Không đẩy được thông báo thì thôi, lệnh may đã nằm trong app rồi.
  }
}

export interface KetQuaXuLy {
  taoMoi: number;
  boQua: number;
  mayDu: number;
}

/**
 * Xử lý một event webhook. Luôn ghi processed_at (hoặc error) để không xử lý lại.
 */
export async function xuLyMotEvent(
  eventId: string,
  goc: string,
): Promise<KetQuaXuLy> {
  const ketQua: KetQuaXuLy = { taoMoi: 0, boQua: 0, mayDu: 0 };

  const { data: ev } = await supabaseServer
    .from("pancake_webhook_events")
    .select("*")
    .eq("id", eventId)
    .limit(1);

  const event = ev?.[0];
  if (!event) return ketQua;

  try {
    const don = chuanHoaDon(event.payload ?? {});
    const ids = don.items
      .map((m) => m.variation_id)
      .filter((x): x is string => !!x);

    const { traCuu, dayDu } = await layTraCuu(Array.from(new Set(ids)));
    const { canXet, boQua } = locMauMaCanMay(don, traCuu);
    ketQua.boQua = boQua.length;

    // Đơn sửa lại: cập nhật mã vận đơn và trạng thái cho lệnh may đã tạo trước đó.
    if (don.id) {
      await supabaseServer
        .from("orders")
        .update({
          pancake_tracking_code: don.tracking_code,
          pancake_carrier: don.carrier,
          pancake_order_status: don.status,
          pancake_customer_name: don.bill_full_name,
          pancake_customer_phone: don.bill_phone_number,
        })
        .eq("pancake_order_id", don.id);
    }

    for (const variationId of canXet) {
      const mauMa = dayDu.get(variationId);
      if (!mauMa) continue;

      const [remainQuantity, dangChoMay, dangChoNhapKho] = await Promise.all([
        layTonKhoTuoi(variationId),
        demDangChoMay(variationId),
        demDangChoNhapKho(variationId),
      ]);

      const { canMay, mayDu } = tinhSoCanMay({
        remainQuantity,
        dangChoMay,
        dangChoNhapKho,
      });

      if (mayDu > 0) {
        ketQua.mayDu += mayDu;
        // Không tự xoá lệnh may — thợ có thể đã may rồi. Gắn cờ cho chủ xưởng tự quyết.
        await supabaseServer
          .from("orders")
          .update({ surplus_flag: true })
          .eq("pancake_variation_id", variationId)
          .eq("status", "pending");
      }

      if (canMay <= 0) continue;

      const productId = await baoDamSanPham(mauMa);
      const { error } = await supabaseServer.from("orders").insert({
        id: `o_${Date.now()}_${maNgauNhien()}`,
        product_id: productId,
        size: mauMa.size || "—",
        color: mauMa.color || "—",
        quantity: canMay,
        remaining_quantity: canMay,
        priority: "normal",
        status: "pending",
        due_date: ngayHan(),
        note: "",
        created_by: await idChuXuong(),
        completed_at: null,
        completed_by: null,
        is_read_by_admin: false,
        created_at: new Date().toISOString(),
        source: "pancake",
        cut_quantity: 0,
        pancake_order_id: don.id,
        pancake_order_display_id: don.id,
        pancake_customer_name: don.bill_full_name,
        pancake_customer_phone: don.bill_phone_number,
        pancake_tracking_code: don.tracking_code,
        pancake_carrier: don.carrier,
        pancake_order_status: don.status,
        pancake_variation_id: variationId,
        pancake_sku: mauMa.display_id,
        image_url: mauMa.image_url,
        surplus_flag: false,
      });
      if (error) throw new Error(`Không tạo được lệnh may: ${error.message}`);

      ketQua.taoMoi += canMay;
      await baoChoTho(canMay, mauMa.display_id || mauMa.product_name, goc);
    }

    await supabaseServer
      .from("pancake_webhook_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", eventId);
  } catch (e: any) {
    await supabaseServer
      .from("pancake_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        error: String(e?.message ?? e).slice(0, 1000),
      })
      .eq("id", eventId);
  }

  return ketQua;
}

/** Xử lý mọi event chưa xử lý. */
export async function xuLyEventTonDong(goc: string, gioiHan = 20) {
  const { data } = await supabaseServer
    .from("pancake_webhook_events")
    .select("id")
    .is("processed_at", null)
    .order("received_at", { ascending: true })
    .limit(gioiHan);

  const tong: KetQuaXuLy = { taoMoi: 0, boQua: 0, mayDu: 0 };
  for (const e of data ?? []) {
    const r = await xuLyMotEvent(e.id, goc);
    tong.taoMoi += r.taoMoi;
    tong.boQua += r.boQua;
    tong.mayDu += r.mayDu;
  }
  return { soEvent: (data ?? []).length, ...tong };
}
