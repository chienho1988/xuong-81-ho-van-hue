/**
 * Hook auto-refresh dùng chung cho tất cả page
 * Gồm:
 * - Realtime subscription theo table (đường chính, cập nhật tức thì)
 * - Poll định kỳ (chỉ là lưới đỡ khi realtime rớt)
 * - visibilitychange (quay lại tab)
 * - window focus
 */
import { useEffect, useRef } from "react";
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

/**
 * Gom các tín hiệu sát nhau thành MỘT lượt tải.
 *
 * Realtime bắn một sự kiện cho MỖI dòng thay đổi. Lượt đồng bộ tồn kho 5 phút
 * một lần có thể gắn cờ "kho đã có hàng" cho hơn chục đơn cùng lúc — tức là hơn
 * chục sự kiện, và trước đây mỗi sự kiện kéo lại nguyên bảng. Chờ 1,5 giây rồi
 * tải một lần là đủ nhanh để chủ xưởng không nhận ra, mà nhẹ hơn cả chục lần.
 */
const GOM_TRONG = 1_500;

export function useAutoRefresh({
  callback,
  table,
  event = "*",
  intervalMs = NHIP_DO_MAC_DINH,
  enabled = true,
}: UseAutoRefreshOptions) {
  // Giữ callback trong ref: nó không nằm trong deps của effect, nếu đọc trực
  // tiếp thì effect sẽ gọi mãi bản callback của lượt render đầu tiên.
  const hamTai = useRef(callback);
  hamTai.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let dungHet = false;
    let hen: ReturnType<typeof setTimeout> | null = null;
    let dangTai = false;

    // Mọi đường — realtime, vòng dò, quay lại tab — đều đi qua đây.
    const taiLai = () => {
      if (dungHet) return;
      // Máy đang khoá hoặc app chạy nền thì không ai nhìn: dò lại chỉ tốn băng
      // thông. Lúc mở lại, visibilitychange bên dưới sẽ tải ngay một lượt.
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (hen) return; // đã có lượt đang chờ, tín hiệu này gom vào lượt đó
      hen = setTimeout(async () => {
        hen = null;
        if (dungHet || dangTai) return;
        dangTai = true;
        try {
          await hamTai.current();
        } finally {
          dangTai = false;
        }
      }, GOM_TRONG);
    };

    // Lượt đầu tiên tải ngay, không chờ gom — người dùng vừa mở màn hình.
    hamTai.current();

    const channelName = `${table}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event, schema: "public", table }, taiLai)
      .subscribe();

    const interval = setInterval(taiLai, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") taiLai();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", taiLai);

    return () => {
      dungHet = true;
      if (hen) clearTimeout(hen);
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", taiLai);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, table, event, intervalMs]);
}
