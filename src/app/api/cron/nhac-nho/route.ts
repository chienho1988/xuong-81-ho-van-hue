/**
 * GET|POST /api/cron/nhac-nho?buoi=sang|chieu
 *
 * 7h30 nhắc cả thợ lẫn chủ xưởng. 14h chỉ nhắc nếu còn đơn trễ hoặc đơn phải xong
 * hôm nay — không có gì thì im lặng (mục 6 của thiết kế).
 * Buổi sáng kèm theo các phiếu nhập kho còn lỗi.
 */
import { supabaseServer } from "@/lib/supabaseServer";
import { dungLoiNhac } from "@/lib/nhacNho";

export const dynamic = "force-dynamic";

async function chay(req: Request) {
  if (req.headers.get("x-xuong81-secret") !== process.env.CRON_SECRET) {
    return Response.json({ ok: false, loi: "sai ma bi mat" }, { status: 401 });
  }

  const buoi =
    new URL(req.url).searchParams.get("buoi") === "chieu" ? "chieu" : "sang";
  const homNay = new Date().toISOString().split("T")[0];
  const goc = new URL(req.url).origin;

  const { data: dons } = await supabaseServer
    .from("orders")
    .select("*")
    .eq("status", "pending");

  const nhac = dungLoiNhac((dons || []) as any, homNay, buoi);

  let loiNhapKho = 0;
  if (buoi === "sang") {
    const { data } = await supabaseServer
      .from("pancake_stock_ins")
      .select("batch_id")
      .eq("status", "error");
    loiNhapKho = (data || []).length;
  }

  if (!nhac && loiNhapKho === 0) {
    return Response.json({ ok: true, imLang: true });
  }

  const noiDung = [
    nhac?.noiDung,
    loiNhapKho > 0
      ? `⚠️ ${loiNhapKho} phiếu nhập kho Pancake đang lỗi, cần xử lý`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tieuDe = nhac?.tieuDe ?? "Có việc cần xử lý";

  for (const role of ["worker", "admin"]) {
    // Thợ không cần biết chuyện nhập kho Pancake.
    const than = role === "worker" ? (nhac?.noiDung ?? "") : noiDung;
    if (!than) continue;
    await fetch(new URL("/api/send-push", goc), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, title: tieuDe, body: than }),
    }).catch(() => {});
  }

  return Response.json({ ok: true, buoi, tieuDe, noiDung, loiNhapKho });
}

export const GET = chay;
export const POST = chay;
