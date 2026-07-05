import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'

export const metadata: Metadata = {
  title: 'Xưởng 81 Hồ Văn Huê',
  description: 'Quản lý đơn hàng và sản lượng xưởng may',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// FIX: Force-dynamic — chặn Next.js render tĩnh
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Service Worker cho Web Push (sw.js không cache gì) + dọn cache của các bản cũ */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  // 1. Đăng ký service worker nhận thông báo push
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  }

  // 2. Xoá cache cũ còn sót từ các bản PWA trước (sw.js mới không cache gì)
  if ('caches' in window) {
    caches.keys().then(function(names) {
      names.forEach(function(name) { caches.delete(name); });
    });
  }
})();
            `,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}