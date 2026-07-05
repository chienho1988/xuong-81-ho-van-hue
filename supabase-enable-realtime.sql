-- ===============================================================
-- Bật Realtime cho table orders (chạy an toàn, không báo lỗi)
-- ===============================================================

-- Chỉ thêm nếu chưa có (tránh lỗi "already member")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'production_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE production_logs;
  END IF;
END $$;

-- Kiểm tra publication đã bật chưa
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';