-- ===============================================================
-- Nối app Xưởng 81 với Pancake POS + theo dõi số đã cắt
-- Thiết kế: docs/superpowers/specs/2026-10-27-ket-noi-pancake-design.md
--
-- CÁCH CHẠY: mở Supabase → SQL Editor → dán cả file này → Run.
-- Chạy lại nhiều lần cũng không sao, mọi lệnh đều có IF NOT EXISTS.
-- ===============================================================

-- ---------------------------------------------------------------
-- 1. Bảng tra cứu mẫu mã Pancake (đồng bộ hằng đêm)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pancake_variants (
  variation_id    TEXT PRIMARY KEY,
  display_id      TEXT,
  product_id      TEXT,
  product_name    TEXT,
  category_name   TEXT,
  color           TEXT,
  size            TEXT,
  image_url       TEXT,
  supplier_ids    TEXT[] DEFAULT '{}',
  retail_price    NUMERIC,
  remain_quantity INTEGER,
  synced_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pancake_variants_display
  ON pancake_variants (display_id);
CREATE INDEX IF NOT EXISTS idx_pancake_variants_tim
  ON pancake_variants (product_name, color, size);

-- ---------------------------------------------------------------
-- 2. Payload thô Pancake gửi sang (chống xử lý trùng + soi khi sự cố)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pancake_webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT,
  updated_at   TEXT,
  payload      JSONB,
  received_at  TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error        TEXT
);

-- Pancake có retry: cùng một đơn với cùng updated_at chỉ được xử lý một lần.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pancake_events_trung
  ON pancake_webhook_events (order_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_pancake_events_chua_xu_ly
  ON pancake_webhook_events (processed_at)
  WHERE processed_at IS NULL;

-- ---------------------------------------------------------------
-- 3. Hàng đợi nhập kho Pancake
--    batch_id là khoá chống nhập kho hai lần (mục 9a của thiết kế):
--    mỗi lượt thợ báo xong sinh đúng một batch_id.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pancake_stock_ins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            TEXT NOT NULL UNIQUE,
  variation_id        TEXT,
  quantity            INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  attempts            INTEGER NOT NULL DEFAULT 0,
  purchase_display_id TEXT,
  error_message       TEXT,
  notified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stock_ins_chua_xong
  ON pancake_stock_ins (status)
  WHERE status IN ('pending', 'error');
CREATE INDEX IF NOT EXISTS idx_stock_ins_mau_ma
  ON pancake_stock_ins (variation_id);

-- Nối một phiếu nhập kho với các dòng sản lượng thuộc về nó.
-- Ở chế độ gộp, một phiếu có thể gồm nhiều đơn.
CREATE TABLE IF NOT EXISTS pancake_stock_in_logs (
  batch_id          TEXT NOT NULL,
  production_log_id TEXT NOT NULL,
  PRIMARY KEY (batch_id, production_log_id)
);

-- ---------------------------------------------------------------
-- 4. Sổ cắt — tách hẳn khỏi production_logs để báo cáo không cộng đôi
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cutting_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   TEXT,
  product_id TEXT,
  quantity   INTEGER NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cutting_logs_ngay
  ON cutting_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cutting_logs_don
  ON cutting_logs (order_id);

-- ---------------------------------------------------------------
-- 5. Cột thêm vào orders
-- ---------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cut_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_order_display_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_tracking_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_order_status INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_variation_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pancake_sku TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS surplus_flag BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_mau_ma_pancake
  ON orders (pancake_variation_id)
  WHERE pancake_variation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_don_pancake
  ON orders (pancake_order_id);

-- ---------------------------------------------------------------
-- 6. Cột thêm vào products
-- ---------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE products ADD COLUMN IF NOT EXISTS pancake_product_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_pancake
  ON products (pancake_product_id)
  WHERE pancake_product_id IS NOT NULL;

-- ---------------------------------------------------------------
-- 7. Backfill một lần: đơn đang có coi như đã cắt đủ.
--    Để 0 thì sáng hôm sau màn Hôm nay báo cả trăm cái "chưa cắt"
--    trong khi hàng đã nằm trên bàn thợ.
-- ---------------------------------------------------------------
UPDATE orders SET cut_quantity = quantity WHERE cut_quantity = 0;

-- ---------------------------------------------------------------
-- 8. RLS: mở hết, đúng kiểu các bảng cũ (app dùng anon key)
-- ---------------------------------------------------------------
ALTER TABLE pancake_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pancake_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pancake_stock_ins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pancake_stock_in_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutting_logs           ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pancake_variants',
    'pancake_webhook_events',
    'pancake_stock_ins',
    'pancake_stock_in_logs',
    'cutting_logs'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'Allow all ' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %L ON %I FOR ALL USING (true) WITH CHECK (true)',
        'Allow all ' || t, t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------
-- 9. Bật Realtime cho các bảng mới (an toàn khi chạy lại)
-- ---------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pancake_stock_ins',
    'cutting_logs'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
