"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (path: string) => pathname.startsWith(path);
  const isAdmin = user?.role === "admin";

  // Thanh dưới của chủ xưởng: Hôm nay · Đơn hàng · Đơn thiếu · Sản phẩm · Báo cáo.
  // Của thợ: Đơn hàng · Lịch sử. Nhập SL và Lịch sử của chủ xưởng nằm trong tab con
  // của Báo cáo (mục 11 của thiết kế) — không tab nào bị mất, chỉ đổi chỗ.
  const tabs = [
    { path: "/hom-nay", icon: "🏠", label: "Hôm nay", cho: "admin" },
    { path: "/don-hang", icon: "📋", label: "Đơn hàng", cho: "ca-hai" },
    { path: "/don-thieu", icon: "📑", label: "Đơn thiếu", cho: "admin" },
    { path: "/san-pham", icon: "🗂️", label: "Sản phẩm", cho: "admin" },
    { path: "/bao-cao", icon: "📊", label: "Báo cáo", cho: "admin" },
    { path: "/lich-su", icon: "🕐", label: "Lịch sử", cho: "tho" },
  ];


  const visibleTabs = tabs.filter(
    (t) => t.cho === "ca-hai" || (isAdmin ? t.cho === "admin" : t.cho === "tho"),
  );

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
