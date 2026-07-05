'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';
import { Order } from '@/lib/mockData';
import { supabase } from '@/lib/supabaseClient';
import { useAutoRefresh } from '@/lib/useAutoRefresh';

function formatTime(iso: string) { return iso.slice(11, 16); }

function ProductThumb({ categoryIcon, categoryColor }: { categoryIcon?: string; categoryColor?: string }) {
  return (
    <div className="order-thumb" style={{ background: (categoryColor ?? '#4A90D9') + '22' }}>
      {categoryIcon || '👔'}
    </div>
  );
}

function BellButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button id="btn-bell" onClick={onClick}
      style={{
        position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 24, padding: '4px 8px', borderRadius: 8, display: 'flex', alignItems: 'center',
      }}
      title="Thông báo">
      🔔{count > 0 && (
        <span style={{
          position: 'absolute', top: 0, right: 0, background: 'var(--danger)', color: '#fff',
          fontSize: 10, fontWeight: 700, borderRadius: 10,
          padding: '1px 5px', minWidth: 16, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  );
}

function NotifPanel({ orders, products, onClose, onReadAll }: {
  orders: Order[]; products: Record<string, { name: string; icon: string; color: string }>;
  onClose: () => void; onReadAll: () => void;
}) {
  const doneOrders = orders.filter(o => o.status === 'done' && o.completed_at)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 56 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '92%', maxWidth: 420, margin: '0 auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>🔔 Thông báo</span>
          <button onClick={onReadAll} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Đọc tất cả</button>
        </div>
        {doneOrders.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15 }}><div style={{ fontSize: 36, marginBottom: 8 }}>🔕</div>Không có thông báo mới</div>
        ) : doneOrders.map(o => {
          const prod = products[o.product_id];
          const isUnread = !o.is_read_by_admin;
          return (
            <div key={o.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: isUnread ? '#F0F7FF' : '#fff', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: isUnread ? 600 : 400 }}>
                  {o.completed_by || 'Công nhân'} đã hoàn thành: {prod?.name} - {o.color} - {o.size} - {o.quantity} cái
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{o.completed_at ? formatTime(o.completed_at) : ''}</div>
              </div>
              {isUnread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ order, products, onDone, onPartial, onDelete, onPinToTop, isAdminView }: {
  order: Order; products: Record<string, { name: string; icon: string; color: string }>;
  onDone: (o: Order) => void; onPartial: (o: Order) => void;
  onDelete: (o: Order) => void; onPinToTop: (o: Order) => void; isAdminView: boolean;
}) {
  const product = products[order.product_id];
  const isUrgent = order.priority === 'urgent';
  const today = new Date().toISOString().split('T')[0];
  const dueToday = order.due_date === today;
  const [swiping, setSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; isDragging.current = true; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientX - startX.current;
    if (diff < 0) { setSwiping(true); setSwipeX(diff); }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = e.changedTouches[0].clientX - startX.current;
    if (diff < -80) onDelete(order);
    setSwiping(false); setSwipeX(0);
  };

  return (
    <div className={isUrgent ? 'card urgent swipeable-card' : 'card swipeable-card'}
      onClick={() => isAdminView && order.status === 'pending' && onPinToTop(order)}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      style={{
        transform: swiping ? `translateX(${swipeX}px)` : 'translateX(0)',
        transition: swiping ? 'none' : 'transform 0.25s ease',
        position: 'relative', overflow: 'hidden', cursor: isAdminView ? 'pointer' : 'default', userSelect: 'none',
      }}>
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 80, background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>🗑 Xoá</div>
      <div style={{ position: 'relative', zIndex: 1, background: '#fff' }}>
        {isUrgent && <div style={{ marginBottom: 8 }}><span className="badge badge-urgent">🔥 GẤP</span>{dueToday && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--warning)', fontWeight: 700 }}>⏰ Hạn hôm nay</span>}</div>}
        <div className="order-card-body">
          <ProductThumb categoryIcon={product?.icon} categoryColor={product?.color} />
          <div className="order-info">
            <div className="order-title">{product?.name || 'Sản phẩm đã xoá'}</div>
            <div className="order-meta">Size: <b>{order.size}</b> · Màu: <b>{order.color}</b></div>
            <div className="order-meta" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{order.remaining_quantity} cái</div>
            {order.note ? <div className="order-meta" style={{ marginTop: 4 }}>📝 {order.note}</div> : null}
          </div>
          {isAdminView && order.status === 'pending' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 6px', background: '#f0f0f0', borderRadius: 6, whiteSpace: 'nowrap' }}>📌 Ấn để pick</span>
              <button onClick={e => { e.stopPropagation(); onDelete(order); }}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, minHeight: 30 }}
                id={`btn-admin-delete-${order.id}`}>🗑 Xoá</button>
            </div>
          )}
        </div>
        {!isAdminView && order.status === 'pending' && (
          <div className="order-done-btn" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success btn-full btn-lg" id={`btn-done-${order.id}`} onClick={e => { e.stopPropagation(); onDone(order); }}>✓ Đã xong</button>
            <button className="btn btn-outline btn-sm" id={`btn-partial-${order.id}`} onClick={e => { e.stopPropagation(); onPartial(order); }} style={{ minWidth: 90 }}>Xong một phần</button>
          </div>
        )}
      </div>
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
  const [products, setProducts] = useState<Record<string, { name: string; icon: string; color: string }>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    
    // DEBUG: Count total orders in DB
    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    console.log(`[Orders] 🔢 Total orders in DB: ${count}`);

    // FIX: Fetch với cache busting query param để tránh PWA cache
    const cacheBuster = `_cb=${Date.now()}`;
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Orders] ❌ Query error:', error);
    } else if (ordersData) {
      console.log(`[Orders] 📦 Fetched ${ordersData.length} orders:`);
      ordersData.forEach(o => {
        console.log(`  - ${o.id}: status=${o.status} priority=${o.priority} product_id=${o.product_id} qty=${o.quantity}`);
      });
      setOrders(ordersData);
    } else {
      console.warn('[Orders] ⚠️ No data returned! Check RLS policy or table exists');
    }

    // Load products + categories
    const { data: categories } = await supabase.from('categories').select('*');
    const { data: productsData } = await supabase.from('products').select('*');
    const productMap: Record<string, { name: string; icon: string; color: string }> = {};
    if (productsData) {
      for (const p of productsData) {
        const cat = categories?.find(c => c.id === p.category_id);
        productMap[p.id] = { name: p.name, icon: cat?.icon || '👔', color: cat?.color || '#4A90D9' };
      }
    }
    setProducts(productMap);
    if (showLoading) setTimeout(() => setRefreshing(false), 300);
  };

  // FIX: Gọi loadData lần đầu, chỉ mount khi có data
  useEffect(() => {
    loadData().then(() => setMounted(true));
  }, []);

  const today = new Date().toISOString().split('T')[0];
  // FIX: Worker và admin dùng CHUNG filter — KHÔNG filter theo is_read_by_admin hay field nào khác
  const pending = orders.filter(o => o.status === 'pending').sort((a, b) => (b.priority === 'urgent' ? 1 : 0) - (a.priority === 'urgent' ? 1 : 0));
  const doneOrders = orders.filter(o => o.status === 'done');
  const doneToday = doneOrders.filter(o => o.completed_at?.startsWith(today));
  const urgentCount = pending.filter(o => o.priority === 'urgent').length;
  const unreadCount = orders.filter(o => o.status === 'done' && !o.is_read_by_admin).length;

  console.log(`[Orders] 👤 ${user?.role || 'unknown'} view: ${pending.length} pending, ${doneOrders.length} done`);

  if (!mounted) return <div className="app-shell"><div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}><span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Đang tải...</span></div></div>;

  const handleDone = (order: Order) => setConfirmOrder(order);
  const handlePartial = (order: Order) => { setPartialOrder(order); setPartialQty(1); };
  const handleDelete = (order: Order) => setDeleteConfirm(order);

  const handlePinToTop = async (order: Order) => {
    await supabase.from('orders').update({ created_at: new Date().toISOString() }).eq('id', order.id);
    loadData();
  };

  const confirmDone = async () => {
    if (!confirmOrder) return;
    await supabase.from('orders').update({ status: 'done', remaining_quantity: 0, completed_at: new Date().toISOString(), completed_by: user?.name || 'Công nhân', is_read_by_admin: false }).eq('id', confirmOrder.id);
    loadData(); setConfirmOrder(null);
  };

  const confirmPartial = async () => {
    if (!partialOrder) return;
    await supabase.from('orders').update({ remaining_quantity: Math.max(0, partialOrder.remaining_quantity - partialQty) }).eq('id', partialOrder.id);
    loadData(); setPartialOrder(null);
  };

  const readAllNotifs = async () => { await supabase.from('orders').update({ is_read_by_admin: true }).eq('status', 'done'); loadData(); };
  const confirmDelete = async () => { if (!deleteConfirm) return; await supabase.from('orders').delete().eq('id', deleteConfirm.id); loadData(); setDeleteConfirm(null); };

  // ─── ADMIN VIEW ───────────────────────────────────────────────
  if (user?.role === 'admin') {
    return (
      <div className="app-shell">
        <div className="page-content scroll-top-padding">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Đơn hàng</h1>
              <div className="subtitle">Đang chờ: <b>{pending.length}</b> đơn{urgentCount > 0 && <span style={{ color: 'var(--danger)' }}> ({urgentCount} 🔥 GẤP)</span>}</div>
            </div>
            <BellButton onClick={() => setShowNotif(true)} count={unreadCount} />
          </div>
          <div className="mini-tabs" style={{ background: '#fff' }}>
            <button className={`mini-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')} id="tab-pending">Chờ may ({pending.length})</button>
            <button className={`mini-tab ${activeTab === 'done' ? 'active' : ''}`} onClick={() => setActiveTab('done')} id="tab-done">Đã xong ({doneOrders.length})</button>
          </div>
          <div className="mt-8" />
          {activeTab === 'pending' ? (
            pending.length === 0 ? <div className="empty-state"><div className="empty-icon">🎉</div>Không có đơn nào đang chờ!</div>
            : pending.map(o => <OrderCard key={o.id} order={o} products={products} onDone={handleDone} onPartial={handlePartial} onDelete={handleDelete} onPinToTop={handlePinToTop} isAdminView={true} />)
          ) : (
            doneOrders.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div>Chưa có đơn nào hoàn thành</div>
            : doneOrders.map(o => {
              const product = products[o.product_id];
              return (
                <div key={o.id} className="card" style={{ opacity: .8 }}>
                  <div className="order-card-body">
                    <ProductThumb categoryIcon={product?.icon} categoryColor={product?.color} />
                    <div className="order-info">
                      <div className="order-title">{product?.name || 'Đã xoá'}</div>
                      <div className="order-meta">Size: <b>{o.size}</b> · Màu: <b>{o.color}</b> · {o.quantity} cái</div>
                      <div style={{ marginTop: 6 }}><span className="badge badge-done">✅ Đã xong</span>{o.completed_at && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{formatTime(o.completed_at)}</span>}</div>
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
        {showNotif && <NotifPanel orders={orders} products={products} onClose={() => setShowNotif(false)} onReadAll={readAllNotifs} />}
        {confirmOrder && (
          <div className="modal-overlay" onClick={() => setConfirmOrder(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Xác nhận hoàn thành</div>
              <p style={{ fontSize: 16, lineHeight: 1.6 }}>Xác nhận đã may xong <b>{confirmOrder.remaining_quantity} cái {products[confirmOrder.product_id]?.name} {confirmOrder.color} {confirmOrder.size}</b>?</p>
              <div className="modal-actions"><button className="btn btn-outline" onClick={() => setConfirmOrder(null)}>Huỷ</button><button className="btn btn-success" onClick={confirmDone}>✓ Đồng ý</button></div>
            </div>
          </div>
        )}
        {partialOrder && (
          <div className="modal-overlay" onClick={() => setPartialOrder(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Xong một phần</div>
              <p style={{ fontSize: 15, marginBottom: 16, color: 'var(--text-secondary)' }}>{products[partialOrder.product_id]?.name} {partialOrder.color} {partialOrder.size} — Tổng: {partialOrder.remaining_quantity} cái</p>
              <div className="form-label">Số đã may xong:</div>
              <div className="qty-stepper" style={{ justifyContent: 'center', marginBottom: 20 }}>
                <button className="qty-btn" onClick={() => setPartialQty(Math.max(1, partialQty - 1))}>−</button>
                <input className="qty-input" type="number" value={partialQty} min={1} max={partialOrder.remaining_quantity - 1} onChange={e => setPartialQty(Math.min(partialOrder.remaining_quantity - 1, Math.max(1, +e.target.value)))} />
                <button className="qty-btn" onClick={() => setPartialQty(Math.min(partialOrder.remaining_quantity - 1, partialQty + 1))}>+</button>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>Còn lại: <b>{partialOrder.remaining_quantity - partialQty} cái</b></p>
              <div className="modal-actions"><button className="btn btn-outline" onClick={() => setPartialOrder(null)}>Huỷ</button><button className="btn btn-primary" onClick={confirmPartial}>Lưu</button></div>
            </div>
          </div>
        )}
        {deleteConfirm && (
          <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Xác nhận xoá</div>
              <p style={{ fontSize: 16, lineHeight: 1.6 }}>Bạn có chắc muốn xoá đơn hàng này không?</p>
              <div className="modal-actions"><button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Huỷ</button><button className="btn btn-danger" onClick={confirmDelete}>🗑 Xoá</button></div>
            </div>
          </div>
        )}
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
            {urgentCount > 0 && <div className="subtitle" style={{ color: 'var(--danger)', fontWeight: 700 }}>🔥 {urgentCount} đơn GẤP cần làm trước!</div>}
          </div>
          <button id="btn-refresh-worker"
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              background: refreshing ? '#e0e0e0' : '#f0f0f0',
              border: '1px solid var(--border)', borderRadius: 8,
              cursor: 'pointer', fontSize: 20, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 4,
              color: 'var(--text)', minHeight: 40,
            }}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>🔄</span>
            {refreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
        {pending.length === 0
          ? <div className="empty-state"><div className="empty-icon">🎉</div>Không có đơn nào! Nghỉ ngơi chút 😊</div>
          : pending.map(o => <OrderCard key={o.id} order={o} products={products} onDone={handleDone} onPartial={handlePartial} onDelete={() => {}} onPinToTop={() => {}} isAdminView={false} />)
        }
        {doneToday.length > 0 && (
          <>
            <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }} onClick={() => setShowDoneToday(s => !s)}>
              {showDoneToday ? '▼' : '▶'} Đã xong hôm nay ({doneToday.length})
            </button>
            {showDoneToday && doneToday.map(o => {
              const product = products[o.product_id];
              return (
                <div key={o.id} className="card" style={{ opacity: .7 }}>
                  <div className="order-card-body">
                    <ProductThumb categoryIcon={product?.icon} categoryColor={product?.color} />
                    <div className="order-info"><div className="order-title">{product?.name || 'Đã xoá'}</div><div className="order-meta">{o.size} · {o.color} · {o.quantity} cái</div><span className="badge badge-done" style={{ marginTop: 6, display: 'inline-block' }}>✅ Đã xong</span></div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}