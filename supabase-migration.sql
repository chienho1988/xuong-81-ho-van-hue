-- ===============================================================
-- Migration: Quản lý xưởng may 81 Hồ Văn Huế
-- Chạy script này trong Supabase SQL Editor
-- ===============================================================

-- 1. USERS (người dùng: admin + công nhân)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'worker')),
  pin TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CATEGORIES (danh mục sản phẩm)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#4A90D9',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCTS (sản phẩm)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  main_image_url TEXT,
  description TEXT DEFAULT '',
  colors TEXT[] DEFAULT '{}',
  sizes TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCT VARIANTS (biến thể sản phẩm: màu + size)
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  image_url TEXT,
  current_quantity INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDERS (đơn hàng)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  due_date TEXT,
  note TEXT DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  completed_at TEXT,
  completed_by TEXT,
  is_read_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRODUCTION LOGS (nhật ký sản xuất)
CREATE TABLE IF NOT EXISTS production_logs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  log_date TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_logs_product ON production_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_logs_worker ON production_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_logs_order ON production_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_logs_date ON production_logs(log_date);

-- ===== ROW LEVEL SECURITY =====
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc cho tất cả (đã xác thực anon key)
CREATE POLICY "Allow all users to read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow all users to read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow all users to read products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow all users to read product_variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Allow all users to read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow all users to read production_logs" ON production_logs FOR SELECT USING (true);

-- Cho phép insert/update/delete cho tất cả (trong app nội bộ, anon key được bảo vệ)
CREATE POLICY "Allow all users to insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow all users to delete users" ON users FOR DELETE USING (true);

CREATE POLICY "Allow all users to insert categories" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update categories" ON categories FOR UPDATE USING (true);
CREATE POLICY "Allow all users to delete categories" ON categories FOR DELETE USING (true);

CREATE POLICY "Allow all users to insert products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow all users to delete products" ON products FOR DELETE USING (true);

CREATE POLICY "Allow all users to insert product_variants" ON product_variants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update product_variants" ON product_variants FOR UPDATE USING (true);
CREATE POLICY "Allow all users to delete product_variants" ON product_variants FOR DELETE USING (true);

CREATE POLICY "Allow all users to insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow all users to delete orders" ON orders FOR DELETE USING (true);

CREATE POLICY "Allow all users to insert production_logs" ON production_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update production_logs" ON production_logs FOR UPDATE USING (true);
CREATE POLICY "Allow all users to delete production_logs" ON production_logs FOR DELETE USING (true);

-- ===== SEED DATA =====
INSERT INTO users (id, name, role, pin) VALUES
  ('u1', 'Chủ xưởng', 'admin', '1234'),
  ('u2', 'Ngọc (Công nhân)', 'worker', '5678')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, icon, color, sort_order) VALUES
  ('c1', 'Áo', '👔', '#4A90D9', 1),
  ('c2', 'Váy', '👗', '#E91E8C', 2),
  ('c3', 'Set', '🧥', '#7B1FA2', 3),
  ('c4', 'Quần', '👖', '#795548', 4),
  ('c5', 'Khác', '🧺', '#546E7A', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, category_id, name, description, colors, sizes, active) VALUES
  ('p1', 'c1', 'Áo thun basic', 'Áo thun cotton thoáng mát', ARRAY['Đen', 'Trắng'], ARRAY['S', 'M', 'L'], true),
  ('p2', 'c1', 'Áo sơ mi công sở', 'Vải lụa cao cấp', ARRAY['Trắng', 'Xanh'], ARRAY['M', 'L'], true),
  ('p3', 'c2', 'Váy chữ A', '', ARRAY['Đen', 'Trắng', 'Đỏ'], ARRAY['Freesize', 'S', 'M'], true),
  ('p4', 'c2', 'Váy maxi dài', 'Vải lụa mỏng', ARRAY['Đen', 'Be', 'Đỏ'], ARRAY['Freesize'], true),
  ('p5', 'c3', 'Set áo + quần', '', ARRAY['Đen', 'Trắng', 'Be'], ARRAY['S', 'M', 'L', 'XL'], true),
  ('p6', 'c3', 'Set váy + áo khoác', '', ARRAY['Đen', 'Trắng', 'Hồng'], ARRAY['Freesize', 'S', 'M'], true),
  ('p7', 'c4', 'Quần tây', '', ARRAY['Đen', 'Xám', 'Be'], ARRAY['S', 'M', 'L', 'XL'], true),
  ('p8', 'c4', 'Quần short', '', ARRAY['Đen', 'Trắng', 'Xanh'], ARRAY['S', 'M', 'L', 'XL'], true),
  ('p9', 'c5', 'Khăn / Phụ kiện', '', ARRAY['Đen', 'Trắng', 'Be', 'Hồng'], ARRAY['Freesize'], true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (id, product_id, color, size) VALUES
  ('v1', 'p1', 'Đen', 'S'), ('v2', 'p1', 'Đen', 'M'), ('v3', 'p1', 'Đen', 'L'),
  ('v4', 'p1', 'Trắng', 'S'), ('v5', 'p1', 'Trắng', 'M'), ('v6', 'p1', 'Trắng', 'L'),
  ('v7', 'p2', 'Trắng', 'M'), ('v8', 'p2', 'Trắng', 'L'),
  ('v9', 'p2', 'Xanh', 'M'), ('v10', 'p2', 'Xanh', 'L'),
  ('v11', 'p3', 'Đen', 'Freesize'), ('v12', 'p3', 'Trắng', 'S'),
  ('v13', 'p4', 'Đen', 'Freesize')
ON CONFLICT (id) DO NOTHING;