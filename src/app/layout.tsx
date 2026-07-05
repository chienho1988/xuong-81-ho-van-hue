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
        {/* FIX: Service Worker Management — xoá cache cũ, unregister, force update */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  // 1. Unregister tất cả service workers cũ
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(reg) {
        reg.unregister();
        console.log('[SW] Unregistered:', reg.scope);
      });
    });
  }

  // 2. Xoá toàn bộ cache cũ (bao gồm cache Supabase API)
  if ('caches' in window) {
    caches.keys().then(function(names) {
      names.forEach(function(name) {
        caches.delete(name);
        console.log('[Cache] Deleted:', name);
      });
    });
  }

  // 3. Chặn PWA install — không cho service worker mới vào
  // (không cần SW vì Supabase realtime đã sync)
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
  });
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