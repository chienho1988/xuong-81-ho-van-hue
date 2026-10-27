"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (path: string) => pathname.startsWith(path);
  const isAdmin = user?.role === "admin";

  const tabs = [
    { path: "/don-hang", icon: "📋", label: "Đơn hàng", adminOnly: false },
    { path: "/san-pham", icon: "🗂️", label: "Sản phẩm", adminOnly: true },
    // Nhập SL gỡ khỏi app thợ (mục 5b): mọi thứ thợ may xong đều phải gắn với
    // một đơn, để có đường vào kho Pancake. Chủ xưởng vẫn ghi bù được.
    { path: "/nhap-san-luong", icon: "✏️", label: "Nhập SL", adminOnly: true },
    { path: "/lich-su", icon: "🕐", label: "Lịch sử", adminOnly: false },
    { path: "/bao-cao", icon: "📊", label: "Báo cáo", adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="bottom-nav" style={{ justifyContent: "space-around" }}>
      {visibleTabs.map((tab) => (
        <button
          key={tab.path}
          className={`nav-tab ${isActive(tab.path) ? "active" : ""}`}
          onClick={() => router.push(tab.path)}
          id={`nav-${tab.path.replace("/", "")}`}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
