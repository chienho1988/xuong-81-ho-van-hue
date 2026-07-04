'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';
import {
  MOCK_CATEGORIES,
  getProductById, Order,
  loadOrders, saveOrdersToStorage,
} from '@/lib/mockData';

function formatTime(iso: string) { return iso.slice(11, 16); }

function ProductThumb({ productId }: { productId: string }) {
  const cat = MOCK_CATEGORIES.find(c => {
    const p = getProductById(productId);
    return p && c.id === p.category_id;
  });
  return (
    <div className="order-thumb" style={{ background: (cat?.color ?? '#4A90D9') + '22' }}>
      {cat?.icon || '👔'}
    </div>
  );
}

function BellButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      id="btn-bell"
      onClick={onClick}
      style={{
        position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 24, padding: '4px 8px', borderRadius: 8,
        display: 'flex', alignItems: 'center',
      }}
      title="Thông báo"
    >
      🔔
      {count > 0 && (
        <span style={{
          position: 'absolute', top: 0, right: 0,
          background: 'var(--danger)', color: '#fff',
          fontSize: 10, fontWeight: 700, borderRadius: 10,
          padding: '1px 5px', minWidth: 16, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  );
}

// Panel thông báo từ orders thật (không dùng MOCK_NOTIFS)
function NotifPanel({ orders, onClose, onReadAll }: {
  orders: Order[];
  onClose: () => void;
  onReadAll: () => void;
}) {
  // Lọc đơn đã hoàn thành, sắp xếp mới nhất lên đầu
  const doneOrders = orders
    .filter(o => o.status === 'done' && o.completed_at)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 56 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: '92%', maxWidth: 420,
          margin: '0 auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>🔔 Thông báo</span>
          <button onClick={onReadAll}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Đọc tất cả
          </button>
        </div>
        {doneOrders.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔕</div>
            Không có thông báo mới
          </div>
        ) : (
          doneOrders.map(o => {
            const product = getProductById(o.product_id);
            const isUnread = !o.is_read_by_admin;
            return (
              <div key={o.id} style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                background: isUnread ? '#F0F7FF' : '#fff',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: isUnread ? 600 : 400 }}>
                    {o.completed_by || 'Công nhân'} đã hoàn thành: {product?.name} - {o.color} - {o.size} - {o.quantity} cái
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {o.completed_at ? formatTime(o.completed_at) : ''}
                  </div>
                </div>
                {isUnread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onDone, onPartial, isAdminView }: {
  order: Order;
  onDone: (o: Order) => void;
  onPartial: (o: Order) => void;
  isAdminView: boolean;
}) {
  const product = getProductById(order.product_id);
  const isUrgent = order.priority === 'urgent';
  const today = new Date().toISOString().split('T')[0];
  const dueToday = order.due_date === today;

  return (
    <div className={`card ${isUrgent ? 'urgent' : ''}`}>
      {isUrgent && (
        <div style={{ marginBottom: 8 }}>
          <span className="badge badge-urgent">🔥 GẤP</span>
          {dueToday && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--warning)', fontWeight: 700 }}>⏰ Hạn hôm nay</span>}
        </div>
      )}
      <div className="order-card-body">
        <ProductThumb productId={order.product_id} />
        <div className="order-info">
          <div className="order-title">{product?.name}</div>
          <div className="order-meta">Size: <b>{order.size}</b> · Màu: <b>{order.color}</b></div>
          <div className="order-meta" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
            {order.remaining_quantity} cái
          </div>
          {order.note ? <div className="order-meta" style={{ marginTop: 4 }}>📝 {order.note}</div> : null}
          {order.status === 'done' && order.completed_by && (
            <div className="order-meta" style={{ marginTop: 4, fontSize: 12, color: 'var(--success)' }}>
              ✅ {order.completed_by} đã hoàn thành
            </div>
          )}
        </div>
      </div>
      {!isAdminView && order.status === 'pending' && (
        <div className="order-done-btn" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-success btn-full btn-lg" id={`btn-done-${order.id}`} onClick={() => onDone(order)}>
            ✓ Đã xong
          </button>
          <button className="btn btn-outline btn-sm" id={`btn-partial-${order.id}`} onClick={() => onPartial(order)} style={{ minWidth: 90 }}>
            Xong một phần
          </button>
        </div>
      )}
    </div>
  );
}

export default function DonHangPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [partialOrder, setPartialOrder] = useState<Order | null>(null);
  const [partialQty, setPartialQty] = useState(1);
  const [showDoneToday, setShowDoneToday] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  // Load orders từ localStorage - chỉ gọi sau khi mounted
  const loadOrdersFromStorage = () => {
    const loaded = loadOrders();
    setOrders(loaded);
  };

  useEffect(() => {
    setMounted(true);
    loadOrdersFromStorage();
    window.addEventListener('ordersUpdated', loadOrdersFromStorage);
    window.addEventListener('storage', (e) => {
      if (e.key === 'xuong81_orders') loadOrdersFromStorage();
    });
    return () => {
      window.removeEventListener('ordersUpdated', loadOrdersFromStorage);
      window.removeEventListener('storage', loadOrdersFromStorage);
    };
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const pending = orders
    .filter(o => o.status === 'pending')
    .sort((a, b) => (b.priority === 'urgent' ? 1 : 0) - (a.priority === 'urgent' ? 1 : 0));
  const doneOrders = orders.filter(o => o.status === 'done');
  const doneToday = doneOrders.filter(o => o.completed_at?.startsWith(today));
  const urgentCount = pending.filter(o => o.priority === 'urgent').length;
  // Chuông admin: đếm đơn đã hoàn thành nhưng admin chưa đọc
  const unreadCount = orders.filter(o => o.status === 'done' && !o.is_read_by_admin).length;

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

  const handleDone = (order: Order) => setConfirmOrder(order);
  const handlePartial = (order: Order) => { setPartialOrder(order); setPartialQty(1); };

  const confirmDone = () => {
    if (!confirmOrder) return;
    const now = new Date().toISOString();
    const newOrders = orders.map(o =>
      o.id === confirmOrder.id
        ? {
            ...o,
            status: 'done' as const,
            remaining_quantity: 0,
            completed_at: now,
            completed_by: user?.name || 'Công nhân',
            is_read_by_admin: false, // admin chưa đọc
          }
        : o
    );
    setOrders(newOrders);
    saveOrdersToStorage(newOrders);
    setConfirmOrder(null);
  };

  const confirmPartial = () => {
    if (!partialOrder) return;
    const newOrders = orders.map(o =>
      o.id === partialOrder.id
        ? { ...o, remaining_quantity: Math.max(0, o.remaining_quantity - partialQty) }
        : o
    );
    setOrders(newOrders);
    saveOrdersToStorage(newOrders);
    setPartialOrder(null);
  };

  // Admin đọc tất cả thông báo: set is_read_by_admin = true cho tất cả đơn done
  const readAllNotifs = () => {
    const newOrders = orders.map(o =>
      o.status === 'done' ? { ...o, is_read_by_admin: true } : o
    );
    setOrders(newOrders);
    saveOrdersToStorage(newOrders);
  };

  // ─── ADMIN VIEW ───────────────────────────────────────────────
  if (user?.role === 'admin') {
    return (
      <div className="app-shell">
        <div className="page-content scroll-top-padding">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Đơn hàng</h1>
              <div className="subtitle">
                Đang chờ: <b>{pending.length}</b> đơn
                {urgentCount > 0 && <span style={{ color: 'var(--danger)' }}> ({urgentCount} 🔥 GẤP)</span>}
              </div>
            </div>
            <BellButton onClick={() => setShowNotif(true)} count={unreadCount} />
          </div>

          <div className="mini-tabs" style={{ background: '#fff' }}>
            <button className={`mini-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')} id="tab-pending">
              Chờ may ({pending.length})
            </button>
            <button className={`mini-tab ${activeTab === 'done' ? 'active' : ''}`} onClick={() => setActiveTab('done')} id="tab-done">
              Đã xong ({doneOrders.length})
            </button>
          </div>

          <div className="mt-8" />

          {activeTab === 'pending' ? (
            pending.length === 0
              ? <div className="empty-state"><div className="empty-icon">🎉</div>Không có đơn nào đang chờ!</div>
              : pending.map(o => <OrderCard key={o.id} order={o} onDone={handleDone} onPartial={handlePartial} isAdminView={true} />)
          ) : (
            doneOrders.length === 0
              ? <div className="empty-state"><div className="empty-icon">📋</div>Chưa có đơn nào hoàn thành</div>
              : doneOrders.map(o => {
                const product = getProductById(o.product_id);
                return (
                  <div key={o.id} className="card" style={{ opacity: .8 }}>
                    <div className="order-card-body">
                      <ProductThumb productId={o.product_id} />
                      <div className="order-info">
                        <div className="order-title">{product?.name}</div>
                        <div className="order-meta">Size: <b>{o.size}</b> · Màu: <b>{o.color}</b> · {o.quantity} cái</div>
                        <div style={{ marginTop: 6 }}>
                          <span className="badge badge-done">✅ Đã xong</span>
                          {o.completed_at && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{formatTime(o.completed_at)}</span>}
                        </div>
                        {o.completed_by && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Bởi: {o.completed_by}</div>}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        <button className="fab" id="fab-dat-hang" onClick={() => router.push('/tao-don')}>+</button>
        <BottomNav />
        {showNotif && <NotifPanel orders={orders} onClose={() => setShowNotif(false)} onReadAll={readAllNotifs} />}
        <ConfirmModal order={confirmOrder} onConfirm={confirmDone} onCancel={() => setConfirmOrder(null)} />
        <PartialModal order={partialOrder} qty={partialQty} setQty={setPartialQty} onConfirm={confirmPartial} onCancel={() => setPartialOrder(null)} />
      </div>
    );
  }

  // ─── WORKER VIEW ──────────────────────────────────────────────
  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Đơn cần may</h1>
            {urgentCount > 0 && (
              <div className="subtitle" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                🔥 {urgentCount} đơn GẤP cần làm trước!
              </div>
            )}
          </div>
        </div>

        {pending.length === 0
          ? <div className="empty-state"><div className="empty-icon">🎉</div>Không có đơn nào! Nghỉ ngơi chút 😊</div>
          : pending.map(o => <OrderCard key={o.id} order={o} onDone={handleDone} onPartial={handlePartial} isAdminView={false} />)
        }

        {doneToday.length > 0 && (
          <>
            <button
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}
              onClick={() => setShowDoneToday(s => !s)}
            >
              {showDoneToday ? '▼' : '▶'} Đã xong hôm nay ({doneToday.length})
            </button>
            {showDoneToday && doneToday.map(o => {
              const product = getProductById(o.product_id);
              return (
                <div key={o.id} className="card" style={{ opacity: .7 }}>
                  <div className="order-card-body">
                    <ProductThumb productId={o.product_id} />
                    <div className="order-info">
                      <div className="order-title">{product?.name}</div>
                      <div className="order-meta">{o.size} · {o.color} · {o.quantity} cái</div>
                      <span className="badge badge-done" style={{ marginTop: 6, display: 'inline-block' }}>✅ Đã xong</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <BottomNav />
      <ConfirmModal order={confirmOrder} onConfirm={confirmDone} onCancel={() => setConfirmOrder(null)} />
      <PartialModal order={partialOrder} qty={partialQty} setQty={setPartialQty} onConfirm={confirmPartial} onCancel={() => setPartialOrder(null)} />
    </div>
  );
}

function ConfirmModal({ order, onConfirm, onCancel }: { order: Order | null; onConfirm: () => void; onCancel: () => void }) {
  if (!order) return null;
  const product = getProductById(order.product_id);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Xác nhận hoàn thành</div>
        <p style={{ fontSize: 16, lineHeight: 1.6 }}>
          Xác nhận đã may xong <b>{order.remaining_quantity} cái {product?.name} {order.color} {order.size}</b>?
        </p>
        <div className="modal-actions">
          <button className="btn btn-outline" id="btn-cancel-confirm" onClick={onCancel}>Huỷ</button>
          <button className="btn btn-success" id="btn-ok-confirm" onClick={onConfirm}>✓ Đồng ý</button>
        </div>
      </div>
    </div>
  );
}

function PartialModal({ order, qty, setQty, onConfirm, onCancel }: {
  order: Order | null; qty: number; setQty: (n: number) => void;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!order) return null;
  const product = getProductById(order.product_id);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Xong một phần</div>
        <p style={{ fontSize: 15, marginBottom: 16, color: 'var(--text-secondary)' }}>
          {product?.name} {order.color} {order.size} — Tổng: {order.remaining_quantity} cái
        </p>
        <div className="form-label">Số đã may xong:</div>
        <div className="qty-stepper" style={{ justifyContent: 'center', marginBottom: 20 }}>
          <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <input className="qty-input" type="number" value={qty} min={1} max={order.remaining_quantity - 1}
            onChange={e => setQty(Math.min(order.remaining_quantity - 1, Math.max(1, +e.target.value)))} />
          <button className="qty-btn" onClick={() => setQty(Math.min(order.remaining_quantity - 1, qty + 1))}>+</button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Còn lại: <b>{order.remaining_quantity - qty} cái</b> vẫn nằm trong danh sách
        </p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Huỷ</button>
          <button className="btn btn-primary" id="btn-ok-partial" onClick={onConfirm}>Lưu</button>
        </div>
      </div>
    </div>
  );
}