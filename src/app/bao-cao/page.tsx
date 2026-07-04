'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';
import { MOCK_PRODUCTS, MOCK_CATEGORIES, getProductById, loadProductionLogs } from '@/lib/mockData';

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0).toISOString().split('T')[0];
  return { start, end };
}

export default function BaoCaoPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selMonth, setSelMonth] = useState(1);
  const [selYear, setSelYear] = useState(2026);
  const [logs, setLogs] = useState<import('@/lib/mockData').ProductionLog[]>([]);

  const loadLogs = () => {
    setLogs(loadProductionLogs());
  };

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setSelMonth(now.getMonth() + 1);
    setSelYear(now.getFullYear());
    loadLogs();
    window.addEventListener('productionLogsUpdated', loadLogs);
    return () => {
      window.removeEventListener('productionLogsUpdated', loadLogs);
    };
  }, []);

  // Chưa mounted: render loading
  if (!mounted) {
    return (
      <div className="app-shell">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}>
          <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Đang tải...</span>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="app-shell">
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>Không có quyền</div>
        <BottomNav />
      </div>
    );
  }

  const { start, end } = getMonthRange(selYear, selMonth);
  const monthLogs = logs.filter(l => l.log_date >= start && l.log_date <= end);

  const totalQty = monthLogs.reduce((s, l) => s + l.quantity, 0);

  // Tổng theo danh mục
  const byCat: Record<string, number> = {};
  monthLogs.forEach(l => {
    const p = getProductById(l.product_id);
    if (p) byCat[p.category_id] = (byCat[p.category_id] || 0) + l.quantity;
  });

  // Top sản phẩm
  const byProd: Record<string, number> = {};
  monthLogs.forEach(l => { byProd[l.product_id] = (byProd[l.product_id] || 0) + l.quantity; });
  const topProds = Object.entries(byProd).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Theo size
  const bySize: Record<string, number> = {};
  monthLogs.forEach(l => { bySize[l.size] = (bySize[l.size] || 0) + l.quantity; });

  // Theo màu
  const byColor: Record<string, number> = {};
  monthLogs.forEach(l => { byColor[l.color] = (byColor[l.color] || 0) + l.quantity; });

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        <div className="page-header">
          <h1>Báo cáo tháng</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <select value={selMonth} onChange={e => setSelMonth(+e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15, background: '#fff' }}
              id="sel-month">
              {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
            <select value={selYear} onChange={e => setSelYear(+e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15, background: '#fff' }}
              id="sel-year">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Tổng */}
        <div className="report-stat">
          <div className="report-stat-label">Tổng sản phẩm tháng {selMonth}/{selYear}</div>
          <div className="report-stat-val">{totalQty} cái</div>
        </div>

        {/* Theo danh mục */}
        <div className="report-stat">
          <div className="report-stat-label" style={{ marginBottom: 12, fontWeight: 700 }}>Theo danh mục</div>
          {Object.entries(byCat).length === 0
            ? <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Không có dữ liệu</div>
            : Object.entries(byCat).map(([catId, qty]) => {
              const cat = MOCK_CATEGORIES.find(c => c.id === catId);
              return (
                <div key={catId} className="report-row">
                  <span>{cat?.icon} {cat?.name}</span>
                  <b>{qty} cái</b>
                </div>
              );
            })
          }
        </div>

        {/* Top sản phẩm */}
        <div className="report-stat">
          <div className="report-stat-label" style={{ marginBottom: 12, fontWeight: 700 }}>Top sản phẩm</div>
          {topProds.length === 0
            ? <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Không có dữ liệu</div>
            : topProds.map(([pId, qty], i) => {
              const p = getProductById(pId);
              return (
                <div key={pId} className="report-row">
                  <span>{i + 1}. {p?.name}</span>
                  <b>{qty} cái</b>
                </div>
              );
            })
          }
        </div>

        {/* Theo size */}
        <div className="report-stat">
          <div className="report-stat-label" style={{ marginBottom: 12, fontWeight: 700 }}>Theo size</div>
          {Object.entries(bySize).length === 0
            ? <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Không có dữ liệu</div>
            : Object.entries(bySize).sort((a, b) => b[1] - a[1]).map(([size, qty]) => (
              <div key={size} className="report-row">
                <span>Size {size}</span>
                <b>{qty} cái</b>
              </div>
            ))
          }
        </div>

        {/* Theo màu */}
        <div className="report-stat">
          <div className="report-stat-label" style={{ marginBottom: 12, fontWeight: 700 }}>Theo màu</div>
          {Object.entries(byColor).length === 0
            ? <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Không có dữ liệu</div>
            : Object.entries(byColor).sort((a, b) => b[1] - a[1]).map(([color, qty]) => (
              <div key={color} className="report-row">
                <span>{color}</span>
                <b>{qty} cái</b>
              </div>
            ))
          }
        </div>

        {/* Xuất Excel */}
        <div style={{ padding: '8px 12px 16px' }}>
          <button className="btn btn-primary btn-full" id="btn-xuat-excel" style={{ fontSize: 16 }}>
            📥 Xuất Excel
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8 }}>
            Xuất Excel định kỳ mỗi tháng để làm bản sao lưu dữ liệu.
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}