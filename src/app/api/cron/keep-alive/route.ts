/**
 * GET|POST /api/cron/keep-alive
 *
 * Supabase bản miễn phí cho dự án ngủ sau 7 ngày không có request nào. Route này
 * chạy một truy vấn nhẹ để giữ dự án thức (mục 7 của thiết kế). Có hai bộ hẹn giờ
 * độc lập gọi vào đây: GitHub Actions và Vercel Cron — cái này chết còn cái kia.
 */
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function chay(req: Request) {
  // Vercel Cron không đặt được header tuỳ ý, nên nhận cả chữ ký của Vercel.
  const coChuKy =
    req.headers.get("x-xuong81-secret") === process.env.CRON_SECRET ||
    (req.headers.get("user-agent") || "").includes("vercel-cron");
  if (!coChuKy) {
    return Response.json({ ok: false, loi: "sai ma bi mat" }, { status: 401 });
  }

  const { count, error } = await supabaseServer
    .from("orders")
    .select("id", { count: "exact", head: true });

  return Response.json({
    ok: !error,
    soDon: count ?? 0,
    luc: new Date().toISOString(),
  });
}

export const GET = chay;
export const POST = chay;
