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
