/**
 * GET|POST /api/cron/keep-alive
 *
 * Supabase bản miễn phí cho dự án ngủ sau 7 ngày không có request nào. Route này
 * chạy một truy vấn nhẹ để giữ dự án thức (mục 7 của thiết kế).
 *
 * 30/10: chỉ còn Vercel Cron gọi vào đây, mỗi ngày một lần. Lượt GitHub Actions
 * trùng giờ đã bỏ — nó nằm cùng workflow với lượt chạy 5 phút một lần vốn đã gõ
 * vào DB 288 lần mỗi ngày, nên không bao giờ là cái cứu được dự án khỏi ngủ.
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

  // Chi can MOT dong de Supabase tinh la co request. Truoc day dem count exact
  // nen moi lan goi la quet ca bang orders - ton bang thong khong vi ly do gi.
  const { error } = await supabaseServer.from("orders").select("id").limit(1);

  return Response.json({ ok: !error, luc: new Date().toISOString() });
}

export const GET = chay;
export const POST = chay;
