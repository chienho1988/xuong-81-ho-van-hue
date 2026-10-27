/**
 * POST /api/pancake/webhook
 *
 * Pancake bắn sang mỗi lần đơn được tạo hoặc sửa. Yêu cầu của Pancake: trả 2xx
 * trong vòng 30 giây, và nếu URL trả lỗi thì Pancake TỰ TẮT webhook của shop.
 * Nên route này chỉ làm đúng ba việc: xác thực, ghi payload thô, trả 200 ngay.
 * Việc xử lý thật chạy ở /api/pancake/xu-ly, gọi kiểu bắn-rồi-quên.
 *
 * Mọi lỗi đều trả 200 kèm { ok: false } — thà mất một event còn hơn bị Pancake
 * tắt webhook của cả shop.
 */
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const biMat = process.env.PANCAKE_WEBHOOK_SECRET;
    if (biMat && req.headers.get("x-xuong81-secret") !== biMat) {
      return Response.json(
        { ok: false, loi: "sai ma bi mat" },
        { status: 401 },
      );
    }

    const chu = await req.text();
    let payload: any = null;
    try {
      payload = chu ? JSON.parse(chu) : null;
    } catch {
      // Payload không phải JSON: vẫn ghi lại nguyên văn để soi, vẫn trả 200.
      payload = { _khong_phai_json: chu.slice(0, 2000) };
    }

    const orderId =
      payload?.id != null
        ? String(payload.id)
        : payload?.order_id != null
          ? String(payload.order_id)
          : null;
    const updatedAt =
      payload?.updated_at != null ? String(payload.updated_at) : null;

    const { error } = await supabaseServer
      .from("pancake_webhook_events")
      .upsert(
        { order_id: orderId, updated_at: updatedAt, payload },
        { onConflict: "order_id,updated_at", ignoreDuplicates: true },
      );
    if (error) {
      return Response.json({ ok: false, loi: error.message }, { status: 200 });
    }

    // Bắn rồi quên: không await, để Pancake không phải chờ.
    try {
      void fetch(new URL("/api/pancake/xu-ly", req.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-xuong81-secret": biMat ?? "",
        },
        body: JSON.stringify({}),
      }).catch(() => {});
    } catch {
      // Không gọi được route xử lý thì lượt quét định kỳ sẽ nhặt event này.
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json(
      { ok: false, loi: String(e?.message ?? e) },
      { status: 200 },
    );
  }
}
