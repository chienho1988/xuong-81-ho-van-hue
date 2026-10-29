/**
 * GET|POST /api/cron/dong-bo-ton
 *
 * Đọc lại tồn kho Pancake cho mọi mẫu mã còn lệnh may đang chờ.
 *
 * Vì sao cần dù đã có webhook tồn kho: chủ xưởng nhập hàng bằng tay trên Pancake
 * ngày 29/10 và app không hay biết gì. Webhook có thể tắt, có thể không bắn cho
 * loại thao tác đó — nên vẫn phải có một đường tự soi lại.
 */
import { supabaseServer } from "@/lib/supabaseServer";
import { dongBoTonKhoMauMa, TOI_DA_QUET } from "@/lib/pancake/tonKho";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function chay(req: Request) {
  if (req.headers.get("x-xuong81-secret") !== process.env.CRON_SECRET) {
    return Response.json({ ok: false, loi: "sai ma bi mat" }, { status: 401 });
  }

  const batDau = Date.now();
  const { data } = await supabaseServer
    .from("orders")
    .select("pancake_variation_id")
    .eq("status", "pending")
    .not("pancake_variation_id", "is", null);

  const ids = (data ?? [])
    .map((o: any) => o.pancake_variation_id as string)
    .filter(Boolean);

  // Xáo trước khi cắt trần: mẫu mã nào cũng có lượt được soi, không để những
  // mẫu đứng cuối danh sách không bao giờ tới lượt.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tam = ids[i];
    ids[i] = ids[j];
    ids[j] = tam;
  }

  const ketQua = await dongBoTonKhoMauMa(ids, TOI_DA_QUET);
  return Response.json({
    ok: true,
    ...ketQua,
    giay: (Date.now() - batDau) / 1000,
  });
}

export const GET = chay;
export const POST = chay;
