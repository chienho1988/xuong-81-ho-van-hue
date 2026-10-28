/**
 * GET|POST /api/cron/dong-bo-san-pham
 *
 * Đưa TOÀN BỘ sản phẩm của "Xưởng nhà làm" vào app, để màn Tạo đơn của chủ xưởng
 * chọn được mọi mẫu của xưởng mình chứ không chỉ những mẫu đã từng có đơn thiếu
 * (chủ xưởng yêu cầu 28/10).
 *
 * Chạy sau lượt đồng bộ danh mục, vì nó đọc từ bảng `pancake_variants`.
 */
import { dongBoSanPhamXuongNha } from "@/lib/pancake/dongBoSanPham";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function chay(req: Request) {
  if (req.headers.get("x-xuong81-secret") !== process.env.CRON_SECRET) {
    return Response.json({ ok: false, loi: "sai ma bi mat" }, { status: 401 });
  }
  const batDau = Date.now();
  try {
    const ketQua = await dongBoSanPhamXuongNha();
    return Response.json({
      ok: true,
      ...ketQua,
      giay: (Date.now() - batDau) / 1000,
    });
  } catch (e: any) {
    return Response.json({ ok: false, loi: String(e?.message ?? e) });
  }
}

export const GET = chay;
export const POST = chay;
