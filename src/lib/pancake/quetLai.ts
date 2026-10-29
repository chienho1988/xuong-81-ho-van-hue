// Quét lại đơn Pancake trong N ngày, nạp vào cùng đường xử lý của luồng A.
//
// Vì sao cần: webhook chỉ bắn khi đơn thay đổi TỪ LÚC bật. Đơn cũ hơn, hoặc đơn
// lọt lưới lúc webhook hỏng, phải có đường quét lại. Lượt đêm chỉ quét 24 giờ;
// chủ xưởng yêu cầu 28/10 quét được xa hơn khi cần.

import { supabaseServer } from "../supabaseServer.ts";
import { SHOP_ID } from "./payload.ts";

/** Trần cứng để một lần bấm nhầm không kéo về cả năm đơn hàng. */
export const SO_NGAY_TOI_DA = 30;
const SO_TRANG_TOI_DA = 20;
const MOI_TRANG = 50;

export interface KetQuaQuetLai {
  soNgay: number;
  soDonQuet: number;
  soDonMoi: number;
  soTrang: number;
  conNua: boolean;
  giay: number;
}

export async function quetLaiDonThieu(
  soNgayXin: number,
  goc: string,
): Promise<KetQuaQuetLai> {
  const batDau = Date.now();
  const soNgay = Math.min(
    SO_NGAY_TOI_DA,
    Math.max(1, Math.round(soNgayXin || 1)),
  );
  const tu = new Date(Date.now() - soNgay * 86400000).toISOString();
  const key = process.env.PANCAKE_API_KEY ?? "";

  let soDonQuet = 0;
  let soDonMoi = 0;
  let trang = 1;
  let conNua = false;

  for (; trang <= SO_TRANG_TOI_DA; trang++) {
    const res = await fetch(
      `https://pos.pages.fm/api/v1/shops/${SHOP_ID}/orders?api_key=${key}` +
        `&page_size=${MOI_TRANG}&page_number=${trang}`,
      { cache: "no-store" },
    );
    if (!res.ok) break;

    const json = await res.json();
    const tatCa = json?.data ?? [];
    if (!tatCa.length) break;

    // Pancake trả đơn mới sửa trước. Tham số lọc ngày của họ bị bỏ qua — đo
    // 29/10: thêm updateStatus vẫn trả đủ 65.950 đơn. Nên tự cắt theo updated_at
    // và dừng ngay khi qua mốc, thay vì kéo về cả năm đơn hàng.
    const dons = tatCa.filter((d: any) => String(d.updated_at ?? "") >= tu);
    soDonQuet += dons.length;
    const hetHan = dons.length < tatCa.length;

    // Ghi một lượt cho cả trang: 50 lượt ghi lẻ mất tới ~30 giây.
    // ignoreDuplicates nên đơn đã xử lý rồi sẽ bị bỏ qua, không làm lại.
    if (!dons.length) break;

    const { data: daGhi } = await supabaseServer
      .from("pancake_webhook_events")
      .upsert(
        dons.map((d: any) => ({
          order_id: String(d.id),
          updated_at: d.updated_at ?? null,
          payload: d,
        })),
        { onConflict: "order_id,updated_at", ignoreDuplicates: true },
      )
      .select("id");
    soDonMoi += (daGhi ?? []).length;

    if (hetHan || tatCa.length < MOI_TRANG) break;
    if (trang === SO_TRANG_TOI_DA) conNua = true;
  }

  if (soDonMoi > 0) {
    await fetch(`${goc}/api/pancake/xu-ly`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-xuong81-secret": process.env.PANCAKE_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify({}),
    }).catch(() => {});
  }

  return {
    soNgay,
    soDonQuet,
    soDonMoi,
    soTrang: trang,
    conNua,
    giay: (Date.now() - batDau) / 1000,
  };
}
