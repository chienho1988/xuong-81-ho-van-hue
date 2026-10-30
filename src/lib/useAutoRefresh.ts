/**
 * Hook auto-refresh dùng chung cho tất cả page
 * Gồm:
 * - Realtime subscription theo table (đường chính, cập nhật tức thì)
 * - Poll định kỳ (chỉ là lưới đỡ khi realtime rớt)
 * - visibilitychange (quay lại tab)
 * - window focus
 * - Debug logging
 */
import { useEffect } from "react";
import { supabase } from "./supabaseClient";

type UseAutoRefreshOptions = {
  callback: () => Promise<void>;
  table: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  intervalMs?: number;
  enabled?: boolean;
};

/**
 * Nhịp dò lại mặc định.
 *
 * Trước 30/10 chỗ này để 2 GIÂY. Mỗi màn dò lại là tải về NGUYÊN bảng, nên một
 * máy mở app cả ngày kéo khoảng 3 GB — ngày 30/10 Supabase khoá cả dự án vì vượt
 * hạn mức băng thông 5 GB/tháng, app chết đứng, không ai đăng nhập được.
 *
 * Realtime mới là đường cập nhật chính và nó tức thì; vòng dò này chỉ để đỡ khi
 * realtime rớt, nên một phút một lần là đủ.
 */
const NHIP_DO_MAC_DINH = 60_000;

export function useAutoRefresh({
  callback,
  table,
  event = "*",
  intervalMs = NHIP_DO_MAC_DINH,
  enabled = true,
}: UseAutoRefreshOptions) {
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    callback();

    // Realtime subscription
    const channelName = `${table}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event, schema: "public", table }, () => {
        callback();
      })
      .subscribe();

    // Poll interval (fallback)
    const interval = setInterval(() => {
      callback();
    }, intervalMs);

    // visibilitychange
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        callback();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // window focus
    const onFocus = () => {
      callback();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, table, event, intervalMs]);
}
