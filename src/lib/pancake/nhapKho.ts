// Hàng đợi nhập kho Pancake (mục 5 và 9a của thiết kế).
//
// Thợ bấm Xong là xong — việc đẩy sang Pancake chạy ngầm phía sau và không bao giờ
// chặn thợ. Chống nhập kho hai lần bằng ràng buộc duy nhất trên `batch_id`:
// mỗi lượt báo xong sinh đúng một batch_id, kể cả khi lượt đó gồm nhiều đơn.

import { supabaseServer } from "../supabaseServer.ts";
import { taoPhieuNhapKho, type KetQuaNhapKho } from "./api.ts";
import type { MucNhapKho } from "./payload.ts";
import { khoaConHan, batchIdChoLog, logChuaVaoKho } from "./doiSoat.ts";

/** Số lần thử lại ngay trong chính lượt gọi, trước khi để lại cho hàng đợi. */
const SO_LAN_THU_NGAY = 3;
const NGHI_GIUA_HAI_LAN_MS = 7000;
/** Dòng đang gửi mà quá ngần này thì coi như lượt trước đã chết, cho giành lại. */
const HAN_GIU_VIEC_MS = 5 * 60 * 1000;

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
    const { error: loiNoi } = await supabaseServer
      .from("pancake_stock_in_logs")
      .upsert(
        viec.production_log_ids.map((id) => ({
          batch_id: viec.batch_id,
          production_log_id: id,
        })),
        { onConflict: "batch_id,production_log_id", ignoreDuplicates: true },
      );
    // Có chỉ mục duy nhất trên production_log_id: một dòng sản lượng chỉ được vào
    // kho đúng một lần. Lỗi ở đây nghĩa là dòng đó đã thuộc một lượt khác rồi.
    if (loiNoi) {
      throw new Error(
        `Dòng sản lượng đã vào kho ở lượt khác: ${loiNoi.message}`,
      );
    }
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
/**
 * Giành một khoá dùng chung trong database. Vercel chạy mỗi lượt gọi trên một máy
 * riêng nên không khoá bằng biến trong bộ nhớ được.
 * Trả về true nếu mình giành được, false nếu luồng khác đang giữ.
 */
export async function giuKhoa(ten: string, giay = 90): Promise<boolean> {
  const bayGio = new Date().toISOString();
  const giuDen = new Date(Date.now() + giay * 1000).toISOString();

  const { data: dangCo } = await supabaseServer
    .from("pancake_locks")
    .select("giu_den")
    .eq("ten", ten)
    .limit(1);

  if (!dangCo || dangCo.length === 0) {
    const { error } = await supabaseServer
      .from("pancake_locks")
      .insert({ ten, giu_den: giuDen });
    // Lỗi ở đây gần như chắc là đụng khoá chính — luồng khác vừa chèn trước.
    return !error;
  }

  if (khoaConHan(dangCo[0].giu_den, bayGio)) return false;

  // Khoá cũ đã hết hạn: chỉ một luồng cướp được, vì điều kiện lọc theo giá trị cũ.
  const { data: cuop } = await supabaseServer
    .from("pancake_locks")
    .update({ giu_den: giuDen })
    .eq("ten", ten)
    .eq("giu_den", dangCo[0].giu_den)
    .select();
  return !!cuop && cuop.length > 0;
}

export async function nhaKhoa(ten: string): Promise<void> {
  await supabaseServer.from("pancake_locks").delete().eq("ten", ten);
}

/**
 * Giành đúng một dòng hàng đợi. Trả về dòng đó nếu giành được, null nếu luồng khác
 * đã lấy. Đây là chỗ chặn NHẬP KHO HAI LẦN: trước bản vá 28/10, hai luồng cùng đọc
 * được một dòng pending rồi cùng gọi Pancake.
 */
async function gianhDong(batchId: string, hienTrang: string) {
  const { data } = await supabaseServer
    .from("pancake_stock_ins")
    .update({ status: "sending", claimed_at: new Date().toISOString() })
    .eq("batch_id", batchId)
    .eq("status", hienTrang)
    .select();
  return data && data.length ? data[0] : null;
}

/**
 * Xả hàng đợi: lấy các dòng chưa vào được Pancake rồi thử lại.
 * Gọi từ route nhập kho (ngay khi thợ bấm Xong), từ cron 5 phút, và từ app khi
 * có người mở màn Đơn hàng — nên bắt buộc phải chống chạy chồng.
 */
export async function xaHangDoi(
  goc: string,
  gioiHan = 10,
): Promise<{ xong: number; loi: number; banRon?: boolean }> {
  if (!(await giuKhoa("xa-hang-doi", 120))) {
    return { xong: 0, loi: 0, banRon: true };
  }

  try {
    const cuHon = new Date(Date.now() - HAN_GIU_VIEC_MS).toISOString();
    const { data } = await supabaseServer
      .from("pancake_stock_ins")
      .select("*")
      .in("status", ["pending", "error", "sending"])
      .order("created_at", { ascending: true })
      .limit(gioiHan);

    let xong = 0;
    let loi = 0;

    for (const dong of data ?? []) {
      // Dòng 'sending' chỉ được giành lại khi lượt giữ nó đã quá cũ.
      if (dong.status === "sending" && (dong.claimed_at ?? "") > cuHon)
        continue;

      const daGianh = await gianhDong(dong.batch_id, dong.status);
      if (!daGianh) continue;

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
  } finally {
    await nhaKhoa("xa-hang-doi");
  }
}

/**
 * Lượt đối soát: tìm hàng ĐÃ MAY XONG mà chưa có đường vào kho, rồi xếp vào hàng đợi.
 *
 * Vì sao cần: lúc thợ bấm Xong, app làm ba bước rời nhau — ghi đơn, ghi sản lượng,
 * gọi nhập kho. Mất mạng ở bước ba thì hàng đã may không có dòng nhập kho nào, mà vế
 * "đã lo liệu" cũng bằng 0, nên lượt đồng bộ sau lại đẻ lệnh may cho đúng số hàng vừa
 * may xong. Lượt đối soát này bịt chỗ đó.
 *
 * Mã lượt suy tất định từ id dòng sản lượng, nên chạy lại bao nhiêu lần cũng chỉ ra
 * một phiếu nhập cho một dòng.
 */
export async function doiSoatSanLuong(soNgay = 7): Promise<number> {
  const tu = new Date(Date.now() - soNgay * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: logs } = await supabaseServer
    .from("production_logs")
    .select("id,order_id,quantity")
    .gte("log_date", tu);
  if (!logs || !logs.length) return 0;

  const { data: daCo } = await supabaseServer
    .from("pancake_stock_in_logs")
    .select("production_log_id")
    .in(
      "production_log_id",
      logs.map((l: any) => l.id),
    );
  const daCoSet = new Set((daCo ?? []).map((x: any) => x.production_log_id));

  const donIds = Array.from(
    new Set(logs.map((l: any) => l.order_id).filter(Boolean)),
  );
  const { data: dons } = await supabaseServer
    .from("orders")
    .select("id,pancake_variation_id")
    .in("id", donIds as string[]);
  const mauMaTheoDon: Record<string, string | null> = {};
  for (const d of dons ?? [])
    mauMaTheoDon[d.id] = d.pancake_variation_id ?? null;

  const thieu = logChuaVaoKho(logs as any, daCoSet, mauMaTheoDon);

  let them = 0;
  for (const l of thieu) {
    const log = logs.find((x: any) => x.id === l.id);
    try {
      await xepHangNhapKho({
        batch_id: batchIdChoLog(l.id),
        variation_id: mauMaTheoDon[l.order_id as string] as string,
        quantity: log?.quantity ?? 0,
        production_log_ids: [l.id],
      });
      them++;
    } catch {
      // Dòng này đã được xếp bởi luồng khác — ràng buộc duy nhất làm đúng việc.
    }
  }
  return them;
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
