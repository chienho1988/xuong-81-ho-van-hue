"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import BottomNav from "@/components/BottomNav";
import { Order } from "@/lib/mockData";
import { supabase } from "@/lib/supabaseClient";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { dungDongDonThieu, xuatExcel, xuatPdf } from "@/lib/xuatFile";

type SanPham = Record<string, { name: string }>;
type Loc = "tat-ca" | "cho-may" | "da-xong";

export default function DonThieuPage() {
  const { user } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<SanPham>({});
  const [ngay, setNgay] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [loc, setLoc] = useState<Loc>("tat-ca");

  // Quét lại đơn thiếu: webhook chỉ bắn khi đơn thay đổi, nên đơn cũ hoặc đơn
  // lọt lưới lúc webhook hỏng phải có đường kéo về tay.
  const [quetNgay, setQuetNgay] = useState(3);
  const [dangQuet, setDangQuet] = useState(false);
  const [tinQuet, setTinQuet] = useState("");

  const load = useCallback(async () => {
    const [{ data: ds }, { data: ps }] = await Promise.all([
      supabase.from("orders").select("*"),
      supabase.from("products").select("id,name"),
    ]);
    const map: SanPham = {};
    for (const p of ps || []) map[p.id] = { name: p.name };
    setProducts(map);
    setOrders(ds || []);
    setMounted(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Dòng nào thợ vừa bấm xong thì tự tô xanh, không cần tải lại trang.
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

  // File có số điện thoại khách nên màn này chỉ chủ xưởng vào được.
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

  const cuaNgay = orders.filter((o) => (o.created_at || "").startsWith(ngay));
  const hienThi = cuaNgay.filter((o) => {
    if (loc === "cho-may") return o.status === "pending";
    if (loc === "da-xong") return o.status === "done";
    return true;
  });

  const dong = dungDongDonThieu(hienThi, products);
  const tongCan = cuaNgay.reduce((t, o) => t + o.quantity, 0);
  const tongXong = cuaNgay
    .filter((o) => o.status === "done")
    .reduce((t, o) => t + o.quantity, 0);

  const quetLai = async () => {
    setDangQuet(true);
    setTinQuet("Đang hỏi Pancake...");
    try {
      const res = await fetch("/api/pancake/quet-lai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ so_ngay: quetNgay }),
      });
      const kq = await res.json();
      if (kq.banRon)
        setTinQuet("Đang có lượt quét khác chạy, chờ một lát rồi bấm lại.");
      else if (!kq.ok)
        setTinQuet(`Không quét được: ${kq.loi ?? "lỗi không rõ"}`);
      else {
        setTinQuet(
          `Đã xem ${kq.soDonQuet} đơn ${kq.soNgay} ngày gần nhất, ` +
            `${kq.soDonMoi} đơn cần xử lý` +
            (kq.conNua ? " (còn nữa, bấm lại để quét tiếp)" : ""),
        );
        await load();
      }
    } catch (e: any) {
      setTinQuet(`Không quét được: ${String(e?.message ?? e)}`);
    } finally {
      setDangQuet(false);
    }
  };

  const doiNgay = (buoc: number) => {
    const d = new Date(`${ngay}T12:00:00`);
    d.setDate(d.getDate() + buoc);
    setNgay(d.toISOString().split("T")[0]);
  };

  return (
    <div className="app-shell">
      <div className="page-header">
        <div>
          <b style={{ fontSize: 20 }}>Đơn thiếu</b>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            {hienThi.length} dòng · {tongCan} cái · đã xong {tongXong}
          </div>
        </div>
      </div>

      <div className="page-content scroll-top-padding">
        <div className="chon-ngay">
          <button onClick={() => doiNgay(-1)} aria-label="Ngày trước">
            ‹
          </button>
          <input
            type="date"
            value={ngay}
            onChange={(e) => setNgay(e.target.value)}
            id="input-ngay"
          />
          <button onClick={() => doiNgay(1)} aria-label="Ngày sau">
            ›
          </button>
        </div>

        <div className="quet-lai">
          <div className="quet-lai-dong">
            <span className="quet-lai-nhan">Quét lại đơn thiếu trong</span>
            {[1, 3, 7, 30].map((n) => (
              <button
                key={n}
                className={quetNgay === n ? "on" : ""}
                onClick={() => setQuetNgay(n)}
                disabled={dangQuet}
              >
                {n} ngày
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary btn-full"
            id="btn-quet-lai"
            onClick={quetLai}
            disabled={dangQuet}
          >
            {dangQuet
              ? "Đang quét..."
              : `Đi tìm đơn thiếu ${quetNgay} ngày qua`}
          </button>
          {tinQuet && <div className="quet-lai-tin">{tinQuet}</div>}
        </div>

        <div className="loc-nhanh">
          {(
            [
              ["tat-ca", "Tất cả"],
              ["cho-may", "Chờ may"],
              ["da-xong", "Đã xong"],
            ] as [Loc, string][]
          ).map(([ma, ten]) => (
            <button
              key={ma}
              className={loc === ma ? "on" : ""}
              onClick={() => setLoc(ma)}
            >
              {ten}
            </button>
          ))}
        </div>

        {hienThi.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📑</div>
            Ngày này không có đơn nào
          </div>
        ) : (
          <>
            <div className="bang-thieu">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Mã vận đơn</th>
                    <th>Khách</th>
                    <th>Sản phẩm thiếu</th>
                    <th>SL</th>
                    <th>Hạn</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {hienThi.map((o, i) => {
                    const d = dong[i];
                    return (
                      <tr
                        key={o.id}
                        className={d.trangThai === "Xong" ? "xong" : ""}
                      >
                        <td>{d.maDon || "—"}</td>
                        <td>{d.maVanDon || "—"}</td>
                        <td>
                          {d.tenKhach || "—"}
                          {d.soDienThoai && (
                            <>
                              <br />
                              <a href={`tel:${d.soDienThoai}`}>
                                {d.soDienThoai}
                              </a>
                            </>
                          )}
                        </td>
                        <td>
                          <div className="o-mau-ma">
                            {o.image_url && (
                              <Image
                                src={o.image_url}
                                alt=""
                                width={28}
                                height={28}
                                unoptimized={false}
                              />
                            )}
                            <span>{d.mauMa}</span>
                          </div>
                        </td>
                        <td>{d.soLuong}</td>
                        <td>{d.hanMay || "—"}</td>
                        <td className="o-trang-thai">{d.trangThai}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="nut-xuat">
              <button
                onClick={() => xuatExcel(dong, `don-thieu-${ngay}.xlsx`)}
                id="btn-xuat-excel"
              >
                Xuất Excel
              </button>
              <button
                onClick={() => xuatPdf(dong, `Đơn thiếu ngày ${ngay}`)}
                id="btn-xuat-pdf"
              >
                Xuất PDF
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
