// Client Supabase dùng trong route server (webhook, cron, nhập kho).
//
// Vẫn là anon key như phía trình duyệt — dự án chưa có service_role key, và RLS
// đang mở hết. Khác chỗ: không giữ phiên, không tự làm mới token, vì mỗi request
// server là một lần chạy riêng.
//
// Dựng LƯỜI (chỉ tạo client ở lần dùng đầu tiên) để các module nghiệp vụ import
// được vào bộ chạy test của Node, nơi không có biến môi trường của Next.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let thuc: SupabaseClient | null = null;

function lay(): SupabaseClient {
  if (!thuc) {
    thuc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
        },
      },
    );
  }
  return thuc;
}

export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_dich, ten) {
    const that = lay() as any;
    const giaTri = that[ten];
    return typeof giaTri === "function" ? giaTri.bind(that) : giaTri;
  },
});
