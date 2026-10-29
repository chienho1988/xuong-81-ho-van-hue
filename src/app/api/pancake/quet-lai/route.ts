/**
 * POST /api/pancake/quet-lai   body { so_ngay }
 *
 * Nút "Quét lại đơn thiếu" trên app chủ xưởng gọi vào đây.
 *
 * KHÔNG chặn bằng mã bí mật vì trình duyệt của chủ xưởng gọi thẳng. Thay vào đó:
 * chỉ ĐỌC đơn của chính shop rồi nạp vào đường xử lý thường ngày (không ghi gì
 * sang Pancake), số ngày bị chặn trần, và một khoá dùng chung không cho hai lượt
 * chạy chồng — nên bấm nhiều lần cũng không làm gì thêm.
 */
import { quetLaiDonThieu } from "@/lib/pancake/quetLai";
import { giuKhoa, nhaKhoa } from "@/lib/pancake/nhapKho";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const goc = new URL(req.url).origin;

  let soNgay = 1;
  try {
    const body = await req.json();
    soNgay = Number(body?.so_ngay ?? 1);
  } catch {
    // Body rỗng thì quét 1 ngày.
  }

  if (!(await giuKhoa("quet-lai", 120))) {
    return Response.json({ ok: false, banRon: true });
  }

  try {
    const ketQua = await quetLaiDonThieu(soNgay, goc);
    return Response.json({ ok: true, ...ketQua });
  } catch (e: any) {
    return Response.json({ ok: false, loi: String(e?.message ?? e) });
  } finally {
    await nhaKhoa("quet-lai");
  }
}
