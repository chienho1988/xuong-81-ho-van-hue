/**
 * GET|POST /api/cron/dong-bo-mau-ma?tu_trang=1&so_trang=20
 *
 * Chép danh mục mẫu mã Pancake về bảng tra cứu nội bộ (mục 4 và 6 của thiết kế).
 * Payload đơn hàng Pancake gửi sang KHÔNG kèm tên nhà cung cấp, chỉ có variation_id,
 * nên phải giữ sẵn bảng này mới biết mẫu nào là "Xưởng nhà làm".
 *
 * Chạy 2h sáng. Shop có ~4.440 mẫu mã (89 trang × 50) nên route in ra số giây chạy;
 * nếu chạm giới hạn thời gian của hàm trên Vercel thì chia nhiều lượt bằng tu_trang.
 *
 * ĐÃ ĐO (27/10/2026): 2 trang mất ~15 giây kể cả ghi Supabase, nên mặc định chạy
 * 6 trang một lượt cho chắc dưới giới hạn 60 giây của hàm Vercel. Bộ hẹn giờ gọi
 * lại với tu_trang = trangKeTiep cho tới khi trangKeTiep = null.
 */
import { supabaseServer } from "@/lib/supabaseServer";
import { layMotTrangMauMa } from "@/lib/pancake/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function chay(req: Request) {
  if (req.headers.get("x-xuong81-secret") !== process.env.CRON_SECRET) {
    return Response.json({ ok: false, loi: "sai ma bi mat" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const tuTrang = Math.max(1, Number(sp.get("tu_trang") ?? 1));
  const soTrang = Math.max(1, Number(sp.get("so_trang") ?? 6));
  const batDau = Date.now();

  let daGhi = 0;
  let tongSoTrang = 1;
  let trang = tuTrang;

  try {
    for (; trang < tuTrang + soTrang; trang++) {
      const { mauMa, tongSoTrang: tst } = await layMotTrangMauMa(trang, 50);
      tongSoTrang = tst;
      if (!mauMa.length) break;
      await supabaseServer
        .from("pancake_variants")
        .upsert(
          mauMa.map((m) => ({ ...m, synced_at: new Date().toISOString() })),
        );
      daGhi += mauMa.length;
      if (trang >= tst) break;
    }
  } catch (e: any) {
    return Response.json({
      ok: false,
      loi: String(e?.message ?? e),
      daGhi,
      dungOTrang: trang,
      giay: (Date.now() - batDau) / 1000,
    });
  }

  return Response.json({
    ok: true,
    daGhi,
    tuTrang,
    trangKeTiep: trang <= tongSoTrang ? trang : null,
    tongSoTrang,
    giay: (Date.now() - batDau) / 1000,
  });
}

export const GET = chay;
export const POST = chay;
