'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useAutoRefresh } from '@/lib/useAutoRefresh';

function formatTime(iso: string) { return iso.slice(11, 16); }

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function LichSuPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selDate, setSelDate] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [products, setProducts] = useState<Record<string, { name: string; catName: string; catIcon: string }>>({});

  const loadLogs = useCallback(async () => {
    const { data: logsData } = await supabase
      .from('production_logs')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: productsData } = await supabase.from('products').select('*');
    const { data: categories } = await supabase.from('categories').select('*');

    if (logsData) setLogs(logsData);

    const productMap: Record<string, { name: string; catName: string; catIcon: string }> = {};
    if (productsData && categories) {
      for (const p of productsData) {
        const cat = categories.find((c: any) => c.id === p.category_id);
        productMap[p.id] = { name: p.name, catName: cat?.name || '', catIcon: cat?.icon || '👔' };
      }
    }
    setProducts(productMap);
  }, []);

  useEffect(() => {
    setMounted(true);
    setSelDate(new Date().toISOString().split('T')[0]);
  }, []);

  // FIX: Auto refresh production logs
  useAutoRefresh({ callback: loadLogs, table: 'production_logs' });

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
    .filter((l: any) => l.log_date === selDate)
    .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));

  const total = filteredLogs.reduce((s: number, l: any) => s + l.quantity, 0);

  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        <div className="page-header">
          <h1>Lịch sử sản lượng</h1>
          {user?.role === 'admin' ? (
            <input type="date" value={selDate}
              onChange={e => setSelDate(e.target.value)}
              style={{ marginTop: 8, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 15 }}
              id="date-picker"
              max={new Date().toISOString().split('T')[0]} />
          ) : (
            <div className="subtitle">{formatDate(selDate)}</div>
          )}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div>Chưa có bản ghi nào ngày này</div>
        ) : (
          <>
            {filteredLogs.map((log: any) => {
              const prod = products[log.product_id];
              return (
                <div key={log.id} className="log-row" id={`log-${log.id}`}>
                  <div className="log-time">{formatTime(log.created_at)}</div>
                  <div className="log-info">
                    <div className="log-product">{prod?.name ?? 'Đã xoá'}</div>
                    <div className="log-detail">{prod?.catIcon} {prod?.catName ?? ''} · {log.color} · {log.size}</div>
                    {log.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>📝 {log.note}</div>}
                  </div>
                  <div className="log-qty">{log.quantity}</div>
                </div>
              );
            })}
            <div className="log-total">Tổng ngày này: <b>{total} cái</b></div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}