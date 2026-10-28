// Đồng bộ TOÀN BỘ sản phẩm của nhà cung cấp "Xưởng nhà làm" vào app.
//
// Khác với cách tạo dần theo nhu cầu ở mục 8b của thiết kế: chỗ đó chỉ tạo sản phẩm
// khi có đơn thiếu, nên màn Tạo đơn của chủ xưởng không thấy những mẫu chưa ai đặt.
// Chủ xưởng yêu cầu 28/10: muốn chọn được MỌI mẫu của xưởng mình khi tạo đơn tay.
//
// Chỉ lấy hàng "Xưởng nhà làm" (704 mẫu mã / 49 sản phẩm tính tới 28/10), không đổ
// cả 4.440 mẫu mã của shop vào app.

import { supabaseServer } from "../supabaseServer.ts";
import { SUPPLIER_ID } from "./payload.ts";

export interface KetQuaDongBoSP {
  mauMaXuongNha: number;
  sanPhamMoi: number;
  sanPhamCapNhat: number;
  phanLoai: number;
  danhMucMoi: number;
}

function chia<T>(ds: T[], co: number): T[][] {
  const ra: T[][] = [];
  for (let i = 0; i < ds.length; i += co) ra.push(ds.slice(i, i + co));
  return ra;
}

export async function dongBoSanPhamXuongNha(): Promise<KetQuaDongBoSP> {
  // 1. Đọc hết bảng tra cứu mẫu mã (Supabase trả tối đa 1000 dòng một lượt).
  let tatCa: any[] = [];
  for (let tu = 0; ; tu += 1000) {
    const { data } = await supabaseServer
      .from("pancake_variants")
      .select(
        "variation_id,display_id,product_id,product_name,category_name,color,size,image_url,supplier_ids",
      )
      .range(tu, tu + 999);
    if (!data || !data.length) break;
    tatCa = tatCa.concat(data);
    if (data.length < 1000) break;
  }

  const cuaXuong = tatCa.filter((v) =>
    (v.supplier_ids ?? []).includes(String(SUPPLIER_ID)),
  );

  const ketQua: KetQuaDongBoSP = {
    mauMaXuongNha: cuaXuong.length,
    sanPhamMoi: 0,
    sanPhamCapNhat: 0,
    phanLoai: 0,
    danhMucMoi: 0,
  };
  if (!cuaXuong.length) return ketQua;

  // 2. Gom theo sản phẩm, gộp màu / size / ảnh từng màu.
  const theoSP = new Map<string, any>();
  for (const v of cuaXuong) {
    let sp = theoSP.get(v.product_id);
    if (!sp) {
      sp = {
        product_id: v.product_id,
        name: v.product_name || v.display_id,
        category_name: v.category_name ?? "Từ Pancake",
        colors: [] as string[],
        sizes: [] as string[],
        color_images: {} as Record<string, string>,
        anhChinh: null as string | null,
      };
      theoSP.set(v.product_id, sp);
    }
    if (v.color && !sp.colors.includes(v.color)) sp.colors.push(v.color);
    if (v.size && !sp.sizes.includes(v.size)) sp.sizes.push(v.size);
    if (v.color && v.image_url && !sp.color_images[v.color]) {
      sp.color_images[v.color] = v.image_url;
    }
    if (!sp.anhChinh && v.image_url) sp.anhChinh = v.image_url;
  }

  // 3. Danh mục: giữ nguyên tên của Pancake để chủ xưởng nhìn là nhận ra.
  const { data: dmCu } = await supabaseServer
    .from("categories")
    .select("id,name");
  const dmTheoTen = new Map<string, string>();
  for (const d of dmCu ?? []) dmTheoTen.set(d.name, d.id);

  const tenDmCan = Array.from(
    new Set(Array.from(theoSP.values()).map((s) => s.category_name)),
  );
  const dmMoi = tenDmCan
    .filter((t) => !dmTheoTen.has(t))
    .map((t, i) => ({
      id: `c_pk_${Date.now()}_${i}`,
      name: t,
      icon: "📦",
      color: "#1976D2",
      sort_order: 900 + i,
    }));
  if (dmMoi.length) {
    await supabaseServer.from("categories").upsert(dmMoi, { onConflict: "id" });
    for (const d of dmMoi) dmTheoTen.set(d.name, d.id);
    ketQua.danhMucMoi = dmMoi.length;
  }

  // 4. Sản phẩm: id tất định theo product_id của Pancake nên chạy lại không trùng.
  const { data: spCu } = await supabaseServer
    .from("products")
    .select("id")
    .eq("source", "pancake");
  const daCo = new Set((spCu ?? []).map((x: any) => x.id));

  const dongSP = Array.from(theoSP.values()).map((s) => {
    const id = `p_pk_${s.product_id}`;
    if (daCo.has(id)) ketQua.sanPhamCapNhat++;
    else ketQua.sanPhamMoi++;
    return {
      id,
      category_id: dmTheoTen.get(s.category_name)!,
      name: s.name,
      main_image_url: s.anhChinh,
      description: "",
      colors: s.colors,
      sizes: s.sizes,
      color_images: s.color_images,
      active: true,
      source: "pancake",
      pancake_product_id: s.product_id,
    };
  });

  for (const lo of chia(dongSP, 200)) {
    const { error } = await supabaseServer
      .from("products")
      .upsert(lo, { onConflict: "id" });
    if (error) throw new Error(`Ghi sản phẩm hỏng: ${error.message}`);
  }

  // 5. Phân loại: một dòng cho mỗi mẫu mã, id tất định theo variation_id.
  const dongPL = cuaXuong.map((v) => ({
    id: `v_pk_${v.variation_id}`,
    product_id: `p_pk_${v.product_id}`,
    color: v.color || "—",
    size: v.size || "—",
    image_url: v.image_url,
    current_quantity: 0,
    note: v.display_id ?? "",
  }));

  for (const lo of chia(dongPL, 300)) {
    const { error } = await supabaseServer
      .from("product_variants")
      .upsert(lo, { onConflict: "id" });
    if (error) throw new Error(`Ghi phân loại hỏng: ${error.message}`);
    ketQua.phanLoai += lo.length;
  }

  return ketQua;
}
