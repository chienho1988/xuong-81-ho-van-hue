-- ===============================================================
-- Bản vá sau vòng soát độc lập 28/10/2026
--
-- Vòng soát bắt được bốn chỗ có thể NHẬP KHO HAI LẦN hoặc ĐẺ LỆNH MAY TRÙNG khi
-- hai luồng chạy chồng nhau (cron 5 phút, app đang mở, và lượt gọi ngay lúc thợ
-- bấm Xong). File này thêm phần database cần cho bản vá.
--
-- CÁCH CHẠY: Supabase → SQL Editor → dán cả file → Run. Chạy lại nhiều lần được.
-- Chạy SAU supabase-pancake.sql.
-- ===============================================================

-- ---------------------------------------------------------------
-- 1. Khoá chống hai luồng cùng làm một việc
--    Vercel chạy mỗi lần gọi trên một máy riêng, không chia sẻ bộ nhớ được,
--    nên khoá phải nằm trong database.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pancake_locks (
  ten     TEXT PRIMARY KEY,
  giu_den TIMESTAMPTZ NOT NULL
);

ALTER TABLE pancake_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pancake_locks'
      AND policyname = 'Allow all pancake_locks'
  ) THEN
    CREATE POLICY "Allow all pancake_locks" ON pancake_locks
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 2. Dấu thời điểm giành việc
--    Một dòng đang ở trạng thái 'sending' mà quá cũ nghĩa là lượt chạy trước đã
--    chết giữa chừng — cho phép giành lại, nếu không nó kẹt mãi.
-- ---------------------------------------------------------------
ALTER TABLE pancake_stock_ins
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------
-- 3. Một dòng sản lượng chỉ được vào kho ĐÚNG MỘT LẦN
--    Trước đây khoá chính là (batch_id, production_log_id), nên cùng một dòng
--    sản lượng gửi lại với batch_id mới là ra thêm một phiếu nhập nữa.
-- ---------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_in_logs_mot_lan
  ON pancake_stock_in_logs (production_log_id);

-- ---------------------------------------------------------------
-- 4. Tra cứu nhanh cho lượt đối soát "đã may xong mà chưa vào kho"
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_production_logs_ngay
  ON production_logs (log_date DESC);
