/**
 * GET|POST /api/cron/doi-chieu-don
 *
 * Đối chiếu lại đơn 24 giờ qua bằng API, không dựa vào webhook. Lý do: Pancake TỰ
 * TẮT webhook của shop khi URL hỏng, nên webhook không được là đường duy nhất
 * (mục 12 của thiết kế). Đơn nào lọt thì nạp vào cùng đường xử lý của luồng A.
 */
import { supabaseServer } from "@/lib/supabaseServer";
import { SHOP_ID } from "@/lib/pancake/payload";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function chay(req: Request) {
  if (req.headers.get("x-xuong81-secret") !== process.env.CRON_SECRET) {
    return Response.json({ ok: false, loi: "sai ma bi mat" }, { status: 401 });
  }

  const batDau = Date.now();
  const tu = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const key = process.env.PANCAKE_API_KEY ?? "";

  const res = await fetch(
    `https://pos.pages.fm/api/v1/shops/${SHOP_ID}/orders?api_key=${key}&page_size=50&page_number=1&updateStatus=${encodeURIComponent(tu)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return Response.json({ ok: false, loi: `Pancake ${res.status}` });
  }

  const json = await res.json();
  const dons = json?.data ?? [];

  // Ghi một lượt thay vì 50 lượt: đo được 50 upsert lẻ mất ~30 giây.
  const { error } = await supabaseServer.from("pancake_webhook_events").upsert(
    dons.map((d: any) => ({
      order_id: String(d.id),
      updated_at: d.updated_at ?? null,
      payload: d,
    })),
    { onConflict: "order_id,updated_at", ignoreDuplicates: true },
  );

  if (!error && dons.length) {
    // Bắn rồi quên, giống webhook. Trước ngày 29/10 chỗ này còn await: đo trên
    // Vercel mất 48,8 giây, sát trần 60 giây của hàm — mà từ nay lượt này chạy
    // mỗi 5 phút chứ không phải mỗi 24 giờ nữa. Route xu-ly có khoá riêng nên
    // hai lượt chồng nhau cũng không làm đôi việc.
    void fetch(
      new URL("/api/pancake/xu-ly", req.url).origin + "/api/pancake/xu-ly",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-xuong81-secret": process.env.PANCAKE_WEBHOOK_SECRET ?? "",
        },
        body: JSON.stringify({}),
      },
    ).catch(() => {});
  }

  return Response.json({
    ok: !error,
    soDon: dons.length,
    loi: error?.message ?? null,
    giay: (Date.now() - batDau) / 1000,
  });
}

export const GET = chay;
export const POST = chay;
