/**
 * POST /api/pancake/xu-ly
 *
 * Body { eventId } để xử lý đúng một event, hoặc body rỗng để xử lý mọi event
 * chưa xử lý. Route webhook gọi route này kiểu bắn-rồi-quên; lượt quét định kỳ
 * và lúc có người mở app cũng gọi vào đây.
 */
import { xuLyMotEvent, xuLyEventTonDong } from "@/lib/pancake/xuLyDon";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const biMat = process.env.PANCAKE_WEBHOOK_SECRET;
  if (biMat && req.headers.get("x-xuong81-secret") !== biMat) {
    return Response.json({ ok: false, loi: "sai ma bi mat" }, { status: 401 });
  }

  const goc = new URL(req.url).origin;

  try {
    let eventId: string | null = null;
    try {
      const body = await req.json();
      eventId = body?.eventId ?? null;
    } catch {
      // Body rỗng là hợp lệ: xử lý toàn bộ hàng tồn.
    }

    const ketQua = eventId
      ? await xuLyMotEvent(eventId, goc)
      : await xuLyEventTonDong(goc);

    return Response.json({ ok: true, ...ketQua });
  } catch (e: any) {
    return Response.json(
      { ok: false, loi: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
