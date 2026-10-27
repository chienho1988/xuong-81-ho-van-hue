// Hàng đợi nhập kho Pancake (mục 5 và 9a của thiết kế).
//
// Thợ bấm Xong là xong — việc đẩy sang Pancake chạy ngầm phía sau và không bao giờ
// chặn thợ. Chống nhập kho hai lần bằng ràng buộc duy nhất trên `batch_id`:
// mỗi lượt báo xong sinh đúng một batch_id, kể cả khi lượt đó gồm nhiều đơn.

import { supabaseServer } from "../supabaseServer.ts";
import { taoPhieuNhapKho, type KetQuaNhapKho } from "./api.ts";
import type { MucNhapKho } from "./payload.ts";

/** Số lần thử lại ngay trong chính lượt gọi, trước khi để lại cho hàng đợi. */
const SO_LAN_THU_NGAY = 3;
const NGHI_GIUA_HAI_LAN_MS = 7000;

export function sinhBatchId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Cộng dồn các lệnh may cùng mẫu mã thành một dòng hàng của phiếu nhập. */
export function gomMucNhapKho(muc: MucNhapKho[]): MucNhapKho[] {
  const theoMauMa: { variation_id: string; quantity: number }[] = [];
  for (const m of muc) {
    const daCo = theoMauMa.find((x) => x.variation_id === m.variation_id);
    if (daCo) daCo.quantity += m.quantity;
    else theoMauMa.push({ variation_id: m.variation_id, quantity: m.quantity });
  }
  return theoMauMa;
}

export interface ViecNhapKho {
  batch_id: string;
  variation_id: string;
  quantity: number;
  production_log_ids: string[];
}

/**
 * Xếp một việc nhập kho vào hàng đợi. Gọi lại với cùng batch_id không tạo dòng mới.
 */
export async function xepHangNhapKho(viec: ViecNhapKho): Promise<void> {
  const { error } = await supabaseServer.from("pancake_stock_ins").upsert(
    {
      batch_id: viec.batch_id,
      variation_id: viec.variation_id,
      quantity: viec.quantity,
      status: "pending",
    },
    { onConflict: "batch_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Không xếp được việc nhập kho: ${error.message}`);

  if (viec.production_log_ids.length) {
    await supabaseServer.from("pancake_stock_in_logs").upsert(
      viec.production_log_ids.map((id) => ({
        batch_id: viec.batch_id,
        production_log_id: id,
      })),
      { onConflict: "batch_id,production_log_id", ignoreDuplicates: true },
    );
  }
}

async function nghi(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function baoLoiChoChuXuong(dong: any, goc: string) {
  if (dong.notified_at) return;
  try {
    await fetch(new URL("/api/send-push", goc), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "admin",
        title: "Nhập kho Pancake thất bại",
        body: `${dong.quantity} cái chưa vào được kho. Mở Báo cáo → Nhập kho Pancake để xử lý.`,
      }),
    });
  } catch {
    // Không đẩy được thông báo thì dòng lỗi vẫn hiện đỏ trên màn Nhập kho Pancake.
  }
  await supabaseServer
    .from("pancake_stock_ins")
    .update({ notified_at: new Date().toISOString() })
    .eq("batch_id", dong.batch_id);
}

/**
 * Xả hàng đợi: lấy các dòng chưa vào được Pancake rồi thử lại.
 * Gọi từ route nhập kho (ngay khi thợ bấm Xong), từ cron 5 phút, và từ app khi
 * có người mở màn Đơn hàng.
 */
export async function xaHangDoi(
  goc: string,
  gioiHan = 10,
): Promise<{ xong: number; loi: number }> {
  const { data } = await supabaseServer
    .from("pancake_stock_ins")
    .select("*")
    .in("status", ["pending", "error"])
    .order("created_at", { ascending: true })
    .limit(gioiHan);

  let xong = 0;
  let loi = 0;

  for (const dong of data ?? []) {
    let ketQua: KetQuaNhapKho = { ok: false, loi: "chưa chạy" };

    for (let lan = 0; lan < SO_LAN_THU_NGAY; lan++) {
      ketQua = await taoPhieuNhapKho(
        [{ variation_id: dong.variation_id, quantity: dong.quantity }],
        `Xưởng 81 tự nhập — lượt ${dong.batch_id}`,
      );
      if (ketQua.ok) break;
      if (lan < SO_LAN_THU_NGAY - 1) await nghi(NGHI_GIUA_HAI_LAN_MS);
    }

    if (ketQua.ok) {
      xong++;
      await supabaseServer
        .from("pancake_stock_ins")
        .update({
          status: "ok",
          attempts: (dong.attempts ?? 0) + SO_LAN_THU_NGAY,
          purchase_display_id: ketQua.displayId,
          error_message: null,
          completed_at: new Date().toISOString(),
        })
        .eq("batch_id", dong.batch_id);
    } else {
      loi++;
      await supabaseServer
        .from("pancake_stock_ins")
        .update({
          status: "error",
          attempts: (dong.attempts ?? 0) + SO_LAN_THU_NGAY,
          error_message: ketQua.loi.slice(0, 1000),
        })
        .eq("batch_id", dong.batch_id);
      await baoLoiChoChuXuong(dong, goc);
    }
  }

  return { xong, loi };
}

/**
 * Chủ xưởng bấm "Tôi đã tự nhập tay". Dòng skipped vẫn được đếm vào vế đã-lo-liệu
 * vĩnh viễn, nếu không thì mỗi lượt đồng bộ app lại đẻ lệnh may cho hàng đã may rồi.
 */
export async function danhDauTuNhapTay(batchId: string): Promise<void> {
  await supabaseServer
    .from("pancake_stock_ins")
    .update({
      status: "skipped",
      completed_at: new Date().toISOString(),
      error_message: "Chủ xưởng tự nhập kho trên Pancake",
    })
    .eq("batch_id", batchId);
}
