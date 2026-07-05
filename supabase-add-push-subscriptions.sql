-- ===============================================================
-- Migration: Bảng push_subscriptions cho Web Push (mục 9 tài liệu)
-- Mỗi user 1 dòng (id = user_id) — đăng nhập lại sẽ update, không trùng.
-- Chạy script này trong Supabase SQL Editor (giống các file
-- supabase-*.sql trước đây).
-- ===============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to read push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow all users to insert push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow all users to update push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow all users to delete push_subscriptions" ON push_subscriptions;

CREATE POLICY "Allow all users to read push_subscriptions" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Allow all users to insert push_subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update push_subscriptions" ON push_subscriptions FOR UPDATE USING (true);
CREATE POLICY "Allow all users to delete push_subscriptions" ON push_subscriptions FOR DELETE USING (true);

-- Báo PostgREST nạp lại schema để bảng mới dùng được ngay qua API
NOTIFY pgrst, 'reload schema';
