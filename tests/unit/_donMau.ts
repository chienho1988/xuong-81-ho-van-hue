import type { Order } from "../../src/lib/mockData.ts";

// Dựng một Order đủ trường để viết test cho gọn.
// Mọi giá trị đều cố định, không dùng Date.now() hay Math.random().
export function donMau(ghiDe: Partial<Order> = {}): Order {
  return {
    id: "don-1",
    product_id: "sp-1",
    size: "M",
    color: "ĐEN",
    quantity: 5,
    remaining_quantity: 5,
    priority: "normal",
    status: "pending",
    due_date: "2026-10-29",
    note: "",
    created_by: "chu-xuong",
    completed_at: null,
    completed_by: null,
    is_read_by_admin: true,
    created_at: "2026-10-20T08:00:00Z",
    ...ghiDe,
  };
}
