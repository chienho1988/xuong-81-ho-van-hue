"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      // Vào thẳng đơn hàng: cả thợ lẫn chủ xưởng mở app lên là để xem hôm nay
      // may gì, không phải để xem danh mục sản phẩm (yêu cầu 29/10).
      router.replace("/don-hang");
    } else {
      router.replace("/dang-nhap");
    }
  }, [user, router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        fontSize: 32,
      }}
    >
      🏭
    </div>
  );
}
