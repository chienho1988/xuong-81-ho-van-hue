-- Reset toàn bộ dữ liệu demo, giữ lại cấu trúc bảng
-- Chạy script này trong Supabase SQL Editor

-- Xoá dữ liệu cũ (theo thứ tự foreign key)
DELETE FROM production_logs;
DELETE FROM orders;
DELETE FROM product_variants;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM users;

-- Reset sequences (nếu có)
-- Re-insert users (bắt buộc để đăng nhập)
INSERT INTO users (id, name, role, pin) VALUES
  ('u1', 'Chủ xưởng', 'admin', '1234'),
  ('u2', 'Ngọc (Công nhân)', 'worker', '5678');