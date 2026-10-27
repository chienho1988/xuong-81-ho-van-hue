// Client Supabase dùng trong route server (webhook, cron, nhập kho).
//
// Vẫn là anon key như phía trình duyệt — dự án chưa có service_role key, và RLS
// đang mở hết. Khác chỗ: không giữ phiên, không tự làm mới token, vì mỗi request
// server là một lần chạy riêng.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  },
});
