'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';
import { MOCK_PRODUCTS, MOCK_CATEGORIES, getProductById, getCategoryById, loadProductionLogs } from '@/lib/mockData';

function formatTime(iso: string) {
  return iso.slice(11, 16);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function LichSuPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selDate, setSelDate] = useState('');
  const [logs, setLogs] = useState<import('@/lib/mockData').ProductionLog[]>([]);

  const loadLogs = () => {
    setLogs(loadProductionLogs());
  };

  useEffect(() => {
    setMounted(true);
    // Chỉ gọi new Date() trong useEffect (client-side)
    setSelDate(new Date().toISOString().split('T')[0]);
    loadLogs();
    window.addEventListener('productionLogsUpdated', loadLogs);
    return () => {
      window.removeEventListener('productionLogsUpdated', loadLogs);
    };
  }, []);

  // Chưa mounted: render loading
  if (!mounted || !selDate) {
    return (
      <div className="app-shell">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}>
          <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Đang tải...</span>
        </div>
      </div>
    );
  }

  const filteredLogs = logs
    .filter(l => l.log_date === selDate)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = filteredLogs.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        <div className="page-header">
          <h1>Lịch sử sản lượng</h1>

          {user?.role === 'admin' ? (
            <input
              type="date" value={selDate}
              onChange={e => setSelDate(e.target.value)}
              style={{ marginTop: 8, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15 }}
              id="date-picker"
              max={new Date().toISOString().split('T')[0]}
            />
          ) : (
            <div className="subtitle">{formatDate(selDate)}</div>
          )}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            Chưa có bản ghi nào ngày này
          </div>
        ) : (
          <>
            {filteredLogs.map(log => {
              const product = getProductById(log.product_id);
              const cat = product ? getCategoryById(product.category_id) : null;
              return (
                <div key={log.id} className="log-row" id={`log-${log.id}`}>
                  <div className="log-time">{formatTime(log.created_at)}</div>
                  <div className="log-info">
                    <div className="log-product">{product?.name ?? 'Đã xoá'}</div>
                    <div className="log-detail">
                      {cat?.icon} {cat?.name ?? ''} · {log.color} · {log.size}
                    </div>
                    {log.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>📝 {log.note}</div>}
                  </div>
                  <div className="log-qty">{log.quantity}</div>
                </div>
              );
            })}

            <div className="log-total">
              Tổng ngày này: <b>{total} cái</b>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}