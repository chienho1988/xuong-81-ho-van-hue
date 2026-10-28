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
import {
  xepHangNhapKho,
  xaHangDoi,
  doiSoatSanLuong,
} from "@/lib/pancake/nhapKho";
import { motMauMaDuyNhat } from "@/lib/pancake/doiSoat";

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
        .select("id,quantity,order_id")
        .in("id", ids);

      if (!logs || logs.length !== ids.length) {
        return Response.json(
          { ok: false, loi: "production_log khong co that" },
          { status: 400 },
        );
      }

      // Dòng nào đã thuộc một lượt nhập kho khác thì từ chối cả lượt — gửi lại
      // cùng một dòng sản lượng với mã lượt mới chính là cách nhập kho nhiều lần.
      const { data: daVaoKho } = await supabaseServer
        .from("pancake_stock_in_logs")
        .select("production_log_id")
        .in("production_log_id", ids);
      if (daVaoKho && daVaoKho.length) {
        return Response.json(
          { ok: false, loi: "dong san luong da vao kho roi" },
          { status: 409 },
        );
      }

      // Mẫu mã lấy từ ĐƠN trong database, không lấy từ body — body do trình duyệt
      // gửi lên và RLS đang mở hết, không được tin.
      const donIds = Array.from(
        new Set(logs.map((l: any) => l.order_id).filter(Boolean)),
      );
      const { data: dons } = await supabaseServer
        .from("orders")
        .select("id,pancake_variation_id")
        .in("id", donIds as string[]);
      const theoDon: Record<string, string | null> = {};
      for (const d of dons ?? []) {
        theoDon[d.id] = d.pancake_variation_id ?? null;
      }

      const mauMa = motMauMaDuyNhat(
        logs.map((l: any) =>
          l.order_id ? (theoDon[l.order_id] ?? null) : null,
        ),
      );
      if (!mauMa) {
        return Response.json(
          { ok: false, loi: "khong xac dinh duoc mau ma tu don" },
          { status: 400 },
        );
      }

      // Số lượng lấy từ sổ sản lượng, không lấy từ con số trình duyệt gửi lên.
      const soThat = logs.reduce((t, l: any) => t + (l.quantity ?? 0), 0);

      try {
        await xepHangNhapKho({
          batch_id: String(body.batch_id),
          variation_id: mauMa,
          quantity: soThat,
          production_log_ids: ids,
        });
      } catch (e: any) {
        return Response.json(
          { ok: false, loi: String(e?.message ?? e) },
          { status: 409 },
        );
      }
    }

    // Body rỗng = lượt quét định kỳ: nhặt luôn hàng đã may mà chưa có đường vào kho.
    let daDoiSoat = 0;
    if (!body?.batch_id) {
      daDoiSoat = await doiSoatSanLuong();
    }

    const ketQua = await xaHangDoi(goc);
    return Response.json({ ok: true, daDoiSoat, ...ketQua });
  } catch (e: any) {
    return Response.json(
      { ok: false, loi: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
