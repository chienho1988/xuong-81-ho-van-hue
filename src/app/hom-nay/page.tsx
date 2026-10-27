"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import BottomNav from "@/components/BottomNav";
import { Order } from "@/lib/mockData";
import { supabase } from "@/lib/supabaseClient";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { tongChuaCat, soMayDuoc } from "@/lib/cat";
import { xepNhomHan } from "@/lib/nhacNho";

type ProductMap = Record<string, { name: string; icon: string; color: string }>;

interface DongCat {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  created_at: string;
}

function gio(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function HomNayPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductMap>({});
  const [dongCat, setDongCat] = useState<DongCat[]>([]);
  const [batchXong, setBatchXong] = useState<Set<string>>(new Set());
  // Chưa chạy migration thì ẩn hẳn phần cắt và phần nhập kho, đừng làm trắng màn.
  const [coCotMoi, setCoCotMoi] = useState(true);

  const homNay = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    const [{ data: ds, error: loiDon }, { data: cats }, { data: prods }] =
      await Promise.all([
        supabase.from("orders").select("*"),
        supabase.from("categories").select("*"),
        supabase.from("products").select("*"),
      ]);

    if (loiDon) {
      setMounted(true);
      return;
    }

    const map: ProductMap = {};
    for (const p of prods || []) {
      const cat = cats?.find((c) => c.id === p.category_id);
      map[p.id] = {
        name: p.name,
        icon: cat?.icon || "👔",
        color: cat?.color || "#4A90D9",
      };
    }
    setProducts(map);
    setOrders(ds || []);
    setCoCotMoi((ds || []).some((o: any) => o.cut_quantity !== undefined));

    // Sổ cắt hôm nay
    const { data: cl, error: loiCat } = await supabase
      .from("cutting_logs")
      .select("*")
      .gte("created_at", `${homNay}T00:00:00`)
      .order("created_at", { ascending: false });
    if (loiCat) setDongCat([]);
    else setDongCat((cl || []) as DongCat[]);

    // Đơn nào đã thật sự vào được kho Pancake hôm nay
    const { data: logs } = await supabase
      .from("production_logs")
      .select("id,order_id")
      .eq("log_date", homNay);
    const ids = (logs || []).map((l: any) => l.id);
    if (ids.length) {
      const { data: noi } = await supabase
        .from("pancake_stock_in_logs")
        .select("batch_id,production_log_id")
        .in("production_log_id", ids);
      const batchIds = Array.from(
        new Set((noi || []).map((n: any) => n.batch_id)),
      );
      if (batchIds.length) {
        const { data: si } = await supabase
          .from("pancake_stock_ins")
          .select("batch_id,status")
          .in("batch_id", batchIds)
          .eq("status", "ok");
        const okBatch = new Set((si || []).map((x: any) => x.batch_id));
        const okOrder = new Set<string>();
        for (const n of noi || []) {
          if (!okBatch.has(n.batch_id)) continue;
          const l = (logs || []).find((x: any) => x.id === n.production_log_id);
          if (l?.order_id) okOrder.add(l.order_id);
        }
        setBatchXong(okOrder);
      } else {
        setBatchXong(new Set());
      }
    } else {
      setBatchXong(new Set());
    }

    setMounted(true);
  }, [homNay]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh({ callback: load, table: "orders" });

  if (!mounted) {
    return (
      <div className="app-shell">
        <div
          className="page-content"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "80dvh",
          }}
        >
          <span style={{ fontSize: 15, color: "var(--text-secondary)" }}>
            Đang tải...
          </span>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="app-shell">
        <div
          style={{ padding: 32, textAlign: "center", color: "var(--danger)" }}
        >
          Không có quyền
        </div>
        <BottomNav />
      </div>
    );
  }

  const pending = orders.filter((o) => o.status === "pending");
  const xongHomNay = orders.filter(
    (o) => o.status === "done" && (o.completed_at || "").startsWith(homNay),
  );

  const tongCanMay = pending.reduce((t, o) => t + o.remaining_quantity, 0);
  const chuaCat = tongChuaCat(pending);
  const choThoMay = pending.reduce((t, o) => t + soMayDuoc(o), 0);
  const tuPancake = pending.filter((o) => o.source === "pancake").length;
  const treHan = pending.filter((o) => xepNhomHan(o, homNay) === "tre");
  const vuaDay = pending
    .filter((o) => o.source === "pancake")
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5);
  const tongCatHomNay = dongCat.reduce((t, d) => t + (d.quantity || 0), 0);

  return (
    <div className="app-shell">
      <div className="page-header">
        <div>
          <b style={{ fontSize: 20 }}>Hôm nay</b>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            {new Date().toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "numeric",
              month: "numeric",
            })}
          </div>
        </div>
      </div>

      <div className="page-content scroll-top-padding">
        {/* Việc cắt đặt TRÊN việc may: chưa cắt thì thợ không may được. */}
        {coCotMoi && (
          <div className="viec-cat">
            <div className="viec-cat-label">✂️ VIỆC CẮT CỦA ANH</div>
            <div className="viec-cat-so">
              {chuaCat}
              <small>cái chưa cắt</small>
            </div>
            <div className="viec-cat-note">
              Thợ còn <b>{choThoMay} cái đã cắt</b> để may.
              {choThoMay === 0 && chuaCat > 0
                ? " Thợ đang hết việc — cần cắt thêm."
                : ""}
            </div>
            <button
              className="viec-cat-btn"
              onClick={() => router.push("/don-hang")}
              id="btn-mo-ban-cat"
            >
              Mở bàn cắt
            </button>
          </div>
        )}

        <div className="tong-can-may">
          <div className="tong-label">🧵 VIỆC MAY CỦA THỢ</div>
          <div className="tong-so">
            {tongCanMay}
            <small>cái cần may</small>
          </div>
          <div className="tong-phu">
            <div>
              <b>{tuPancake}</b>
              <span>đơn từ Pancake</span>
            </div>
            <div>
              <b>{pending.length}</b>
              <span>đơn chờ may</span>
            </div>
            <div>
              <b>{treHan.length}</b>
              <span>đơn trễ hạn</span>
            </div>
          </div>
        </div>

        {treHan.length > 0 && (
          <div className="canh-bao-tre">
            {treHan.slice(0, 3).map((o) => (
              <div key={o.id}>
                ⚠️ <b>{products[o.product_id]?.name || "Sản phẩm"}</b> ·{" "}
                {o.color} · {o.size} trễ hạn {o.due_date}.
                {o.pancake_order_id
                  ? ` Đơn Pancake #${o.pancake_order_id}${
                      o.pancake_customer_name
                        ? ` — ${o.pancake_customer_name}`
                        : ""
                    } đang chờ.`
                  : ""}
              </div>
            ))}
          </div>
        )}

        {vuaDay.length > 0 && (
          <>
            <div className="muc-tieu-de">📥 PANCAKE VỪA ĐẨY SANG</div>
            {vuaDay.map((o) => (
              <div key={o.id} className="dong-hom-nay">
                <div>
                  <b>
                    {o.pancake_sku ||
                      products[o.product_id]?.name ||
                      "Sản phẩm"}
                  </b>
                  <span>
                    {o.pancake_order_id ? `#${o.pancake_order_id} · ` : ""}
                    {o.pancake_customer_name || ""}
                    {o.created_at ? ` · ${gio(o.created_at)}` : ""}
                  </span>
                </div>
                <div className="dong-so">
                  {o.remaining_quantity}
                  <small>cái</small>
                </div>
              </div>
            ))}
          </>
        )}

        {xongHomNay.length > 0 && (
          <>
            <div className="muc-tieu-de">✅ ĐÃ XONG HÔM NAY</div>
            {xongHomNay.map((o) => (
              <div key={o.id} className="dong-hom-nay">
                <div>
                  <b>{products[o.product_id]?.name || "Sản phẩm"}</b>
                  <span>
                    {o.color} · {o.size} · {o.completed_by || ""}{" "}
                    {gio(o.completed_at)}
                  </span>
                  {batchXong.has(o.id) && (
                    <span className="nhan-kho">ĐÃ NHẬP KHO PANCAKE</span>
                  )}
                </div>
                <div className="dong-so">
                  {o.quantity}
                  <small>cái</small>
                </div>
              </div>
            ))}
          </>
        )}

        {coCotMoi && dongCat.length > 0 && (
          <>
            <div className="muc-tieu-de">✂️ ANH ĐÃ CẮT HÔM NAY</div>
            {dongCat.map((d) => (
              <div key={d.id} className="dong-hom-nay">
                <div>
                  <b>
                    {(d.product_id && products[d.product_id]?.name) ||
                      "Sản phẩm"}
                  </b>
                  <span>{gio(d.created_at)}</span>
                </div>
                <div className="dong-so cam">+{d.quantity}</div>
              </div>
            ))}
            <div className="tong-cat-ngay">
              <span>Tổng cắt hôm nay</span>
              <span>{tongCatHomNay} cái</span>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
