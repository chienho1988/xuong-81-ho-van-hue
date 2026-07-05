-- ===============================================================
-- Migration: Thêm cột color_images vào bảng products
-- Ảnh riêng cho từng màu, key = tên màu, value = ảnh (data URL)
-- Màu nào không có ảnh riêng sẽ fallback về main_image_url.
-- Chạy script này trong Supabase SQL Editor (giống các file
-- supabase-*.sql trước đây).
-- ===============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS color_images JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Báo PostgREST nạp lại schema để cột mới dùng được ngay qua API
NOTIFY pgrst, 'reload schema';
