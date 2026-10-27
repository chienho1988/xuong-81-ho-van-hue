/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ảnh mẫu mã lấy thẳng từ Pancake (lưu đường dẫn, không tải về base64).
  // Pancake trả cache-control: max-age=0 nên phải đi qua next/image để Vercel
  // tự cache lại, nếu không mỗi lần mở màn là tải lại từ đầu.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "content.pancake.vn", pathname: "/**" },
    ],
  },
  // FIX: Thêm headers chống cache cho Supabase và trang động
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      // Chặn cache cho Supabase API requests
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

module.exports = nextConfig;
