// Xếp nhóm đơn theo hạn và dựng lời nhắc hàng ngày (mục 6 của thiết kế).
//
// Thuần, không mạng — route cron và màn của thợ đều dùng chung.

import type { Order } from "./mockData.ts";

export type NhomHan = "tre" | "hom-nay" | "con-thoi-gian";

export function xepNhomHan(don: Order, homNay: string): NhomHan {
  if (!don.due_date) return "con-thoi-gian";
  if (don.due_date < homNay) return "tre";
  if (don.due_date === homNay) return "hom-nay";
  return "con-thoi-gian";
}

export interface LoiNhac {
  tieuDe: string;
  noiDung: string;
}

/**
 * Dựng lời nhắc hàng ngày (mục 6 của thiết kế).
 *
 * Buổi sáng 7h30 nhắc toàn cảnh. Buổi chiều 14h CHỈ nhắc khi còn đơn trễ hoặc đơn
 * phải xong hôm nay — không có gì thì im lặng, để thông báo không thành thứ bị
 * phớt lờ. Đếm theo SỐ CÁI, vì đó là con số thợ làm việc với.
 */
export function dungLoiNhac(
  dons: Order[],
  homNay: string,
  buoi: "sang" | "chieu",
): LoiNhac | null {
  const choMay = dons.filter((d) => d.status !== "done");
  const cai = (ds: Order[]) =>
    ds.reduce((t, d) => t + (d.remaining_quantity ?? 0), 0);

  const tre = choMay.filter((d) => xepNhomHan(d, homNay) === "tre");
  const nay = choMay.filter((d) => xepNhomHan(d, homNay) === "hom-nay");
  const soTre = cai(tre);
  const soNay = cai(nay);
  const tong = cai(choMay);

  if (buoi === "chieu" && soTre === 0 && soNay === 0) return null;
  if (tong === 0) return null;

  const phan: string[] = [];
  if (soTre > 0) phan.push(`${soTre} cái TRỄ HẠN (${tre.length} đơn)`);
  if (soNay > 0)
    phan.push(`${soNay} cái phải xong hôm nay (${nay.length} đơn)`);
  if (!phan.length) phan.push(`${tong} cái đang chờ may`);

  return {
    tieuDe:
      buoi === "sang"
        ? `Hôm nay cần may ${tong} cái`
        : `Còn ${soTre + soNay} cái phải xong hôm nay`,
    noiDung: phan.join(" · "),
  };
}
