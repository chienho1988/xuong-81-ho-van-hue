/**
 * POST /api/pancake/nhap-kho
 *
 * Body đầy đủ { batch_id, variation_id, quantity, production_log_ids } để xếp một
 * việc nhập kho rồi xả luôn; body rỗng chỉ xả hàng đợi (cron 5 phút, và app gọi khi
 * có người mở màn Đơn hàng).
 *
 * Route này KHÔNG chặn bằng mã bí mật vì trình duyệt của thợ gọi thẳng vào. Thay
 * vào đó nó tự kiểm tra các production_log_id có thật và cộng đúng số lượng — app
 * ghi bằng anon key với RLS mở hết, nên không được tin con số gửi lên.
 */
import { supabaseServer } from "@/lib/supabaseServer";
import { xepHangNhapKho, xaHangDoi } from "@/lib/pancake/nhapKho";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const goc = new URL(req.url).origin;

  try {
    let body: any = {};
    try {
      body = (await req.json()) ?? {};
    } catch {
      // Body rỗng là hợp lệ.
    }

    if (body?.batch_id && body?.variation_id) {
      const ids: string[] = Array.isArray(body.production_log_ids)
        ? body.production_log_ids.map((x: any) => String(x))
        : [];

      if (!ids.length) {
        return Response.json(
          { ok: false, loi: "thieu production_log_ids" },
          { status: 400 },
        );
      }

      const { data: logs } = await supabaseServer
        .from("production_logs")
        .select("id,quantity")
        .in("id", ids);

      if (!logs || logs.length !== ids.length) {
        return Response.json(
          { ok: false, loi: "production_log khong co that" },
          { status: 400 },
        );
      }

      // Số lượng lấy từ sổ sản lượng, không lấy từ con số trình duyệt gửi lên.
      const soThat = logs.reduce((t, l: any) => t + (l.quantity ?? 0), 0);

      await xepHangNhapKho({
        batch_id: String(body.batch_id),
        variation_id: String(body.variation_id),
        quantity: soThat,
        production_log_ids: ids,
      });
    }

    const ketQua = await xaHangDoi(goc);
    return Response.json({ ok: true, ...ketQua });
  } catch (e: any) {
    return Response.json(
      { ok: false, loi: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
