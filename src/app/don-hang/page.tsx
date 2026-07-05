'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';
import { Order } from '@/lib/mockData';
import { supabase } from '@/lib/supabaseClient';
import { useAutoRefresh } from '@/lib/useAutoRefresh';

type ProductMap = Record<string, { name: string; icon: string; color: string; image: string | null; colorImages: Record<string, string> }>;

// Ảnh cho 1 đơn cụ thể: ưu tiên ảnh theo màu, fallback ảnh chung
function imageForOrder(product: ProductMap[string] | undefined, orderColor: string): string | null {
  if (!product) return null;
  return product.colorImages[orderColor] || product.image;
}

// Hiển thị giờ theo múi giờ máy (không dùng slice ISO vì đó là giờ UTC)
function formatWhen(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${d.getDate()}/${d.getMonth() + 1} ${time}`;
}

function ProductThumb({ icon, color, image }: { icon?: string; color?: string; image?: string | null }) {
  return (
    <div className="order-thumb" style={{ background: (color ?? '#4A90D9') + '1A' }}>
      {image
        ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (icon || '👔')}
    </div>
  );
}

function BellButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button id="btn-bell" className="bell-btn" onClick={onClick} title="Thông báo">
      🔔
      {count > 0 && <span className="bell-badge">{count > 99 ? '99+' : count}</span>}
    </button>
  );
}

function NotifPanel({ orders, products, onClose, onReadAll }: {
  orders: Order[]; products: ProductMap;
  onClose: () => void; onReadAll: () => void;
}) {
  const doneOrders = orders
    .filter(o => o.status === 'done' && o.completed_at)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    .slice(0, 30);
  const hasUnread = doneOrders.some(o => !o.is_read_by_admin);
  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 56 }}>
      <div className="notif-panel" onClick={e => e.stopPropagation()}>
        <div className="notif-head">
          <span style={{ fontWeight: 700, fontSize: 16 }}>🔔 Thông báo</span>
          {hasUnread && (
            <button className="notif-readall" onClick={onReadAll} id="btn-read-all">Đánh dấu đã đọc</button>
          )}
        </div>
        <div style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
          {doneOrders.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🔕</div>
              Chưa có thông báo.<br />Khi công nhân hoàn thành đơn, thông báo sẽ hiện ở đây.
            </div>
          ) : doneOrders.map(o => {
            const prod = products[o.product_id];
            const isUnread = !o.is_read_by_admin;
            return (
              <div key={o.id} className={`notif-row ${isUnread ? 'unread' : ''}`}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: isUnread ? 600 : 400 }}>
                    <b>{o.completed_by || 'Công nhân'}</b> đã xong {o.quantity} cái {prod?.name || 'sản phẩm'} · {o.color} · {o.size}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{formatWhen(o.completed_at)}</div>
                </div>
                {isUnread && <span className="notif-dot" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── THẺ ĐƠN HÀNG (dùng chung admin + công nhân) ───────────────
function OrderCard({ order, products, isAdmin, onDone, onPartial, onDelete, onPin, onToggleUrgent }: {
  order: Order; products: ProductMap; isAdmin: boolean;
  onDone: (o: Order) => void; onPartial: (o: Order) => void;
  onDelete: (o: Order) => void; onPin: (o: Order) => void; onToggleUrgent: (o: Order) => void;
}) {
  const product = products[order.product_id];
  const isUrgent = order.priority === 'urgent';
  const today = new Date().toISOString().split('T')[0];
  const dueToday = order.due_date === today;

  return (
    <div className={`order-card ${isUrgent ? 'urgent' : ''}`}>
      <div className="order-row">
        <ProductThumb icon={product?.icon} color={product?.color} image={imageForOrder(product, order.color)} />
        <div className="order-main">
          <div className="order-title">
            {product?.name || 'Sản phẩm đã xoá'}
            {isUrgent && <span className="badge badge-urgent">🔥 GẤP</span>}
          </div>
          <div className="order-chips">
            <span className="chip">Size {order.size}</span>
            <span className="chip">{order.color}</span>
            {dueToday && <span className="chip chip-due">⏰ Hạn hôm nay</span>}
          </div>
          {order.note && <div className="order-note">📝 {order.note}</div>}
        </div>
        <div className="order-qty">
          <b>{order.remaining_quantity}</b>
          <span>cái</span>
        </div>
      </div>

      {isAdmin ? (
        <div className="order-actions">
          <span className="order-time">Tạo {formatWhen(order.created_at)}</span>
          <button className={`act-btn ${isUrgent ? 'on' : ''}`} id={`btn-urgent-${order.id}`}
            onClick={() => onToggleUrgent(order)}>
            🔥 {isUrgent ? 'Bỏ gấp' : 'Gấp'}
          </button>
          <button className="act-btn" id={`btn-pin-${order.id}`} onClick={() => onPin(order)}>
            📌 Lên đầu
          </button>
          <button className="act-btn danger" id={`btn-admin-delete-${order.id}`} onClick={() => onDelete(order)}>
            🗑
          </button>
        </div>
      ) : (
        <div className="order-actions">
          <button className="btn btn-success" id={`btn-done-${order.id}`}
            style={{ flex: 2, minHeight: 46, fontSize: 15.5 }}
            onClick={() => onDone(order)}>
            ✓ Xong hết
          </button>
          {order.remaining_quantity > 1 && (
            <button className="btn btn-outline" id={`btn-partial-${order.id}`}
              style={{ flex: 1, minHeight: 46, fontSize: 14, padding: '8px 10px' }}
              onClick={() => onPartial(order)}>
              Một phần
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DoneCard({ order, products }: { order: Order; products: ProductMap }) {
  const product = products[order.product_id];
  return (
    <div className="order-card done">
      <div className="order-row">
        <ProductThumb icon={product?.icon} color={product?.color} image={imageForOrder(product, order.color)} />
        <div className="order-main">
          <div className="order-title" style={{ fontSize: 14.5 }}>{product?.name || 'Sản phẩm đã xoá'}</div>
          <div className="order-chips">
            <span className="chip">Size {order.size}</span>
            <span className="chip">{order.color}</span>
            <span className="chip">{order.quantity} cái</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            ✅ {order.completed_by || 'Đã xong'} · {formatWhen(order.completed_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DonHangPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  // Chờ CẢ đơn hàng lẫn sản phẩm tải xong mới hiện — tránh chớp "Sản phẩm đã xoá"
  const mounted = ordersLoaded && productsLoaded;
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<ProductMap>({});
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [partialOrder, setPartialOrder] = useState<Order | null>(null);
  const [partialQty, setPartialQty] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [showDoneToday, setShowDoneToday] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Orders] Query error:', error);
      return;
    }
    setOrders(data || []);
    setOrdersLoaded(true);
  };

  const loadProducts = async () => {
    // select('*') để không lỗi khi cột color_images chưa được migrate
    const [{ data: categories }, { data: productsData }] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('products').select('*'),
    ]);
    const map: ProductMap = {};
    for (const p of productsData || []) {
      const cat = categories?.find(c => c.id === p.category_id);
      map[p.id] = {
        name: p.name, icon: cat?.icon || '👔', color: cat?.color || '#4A90D9',
        image: p.main_image_url || null, colorImages: p.color_images || {},
      };
    }
    setProducts(map);
    setProductsLoaded(true);
  };

  useEffect(() => { loadProducts(); }, []);

  // Realtime + poll 2s + refetch khi quay lại tab
  useAutoRefresh({ callback: loadOrders, table: 'orders' });

  const manualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOrders(), loadProducts()]);
    setTimeout(() => setRefreshing(false), 300);
  };

  // Cập nhật đơn + báo lỗi rõ ràng (không nuốt lỗi)
  const updateOrder = async (id: string, updates: Partial<Order>): Promise<boolean> => {
    const { error } = await supabase.from('orders').update(updates).eq('id', id);
    if (error) {
      console.error('[Orders] Update error:', error);
      showToast('❌ Lỗi kết nối, thử lại');
      return false;
    }
    await loadOrders();
    return true;
  };

  const today = new Date().toISOString().split('T')[0];
  const pending = orders
    .filter(o => o.status === 'pending')
    .sort((a, b) => {
      if ((a.priority === 'urgent') !== (b.priority === 'urgent')) return a.priority === 'urgent' ? -1 : 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  const doneOrders = orders
    .filter(o => o.status === 'done')
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  const doneToday = doneOrders.filter(o => o.completed_at?.startsWith(today));
  const urgentCount = pending.filter(o => o.priority === 'urgent').length;
  const unreadCount = orders.filter(o => o.status === 'done' && !o.is_read_by_admin).length;

  if (!mounted) {
    return (
      <div className="app-shell">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}>
          <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Đang tải...</span>
        </div>
      </div>
    );
  }

  // Push cho admin khi công nhân xong đơn — fire-and-forget, không chặn UI
  const notifyAdminDone = (order: Order, doneQty: number, extra: string) => {
    if (user?.role !== 'worker') return;
    const prod = products[order.product_id];
    fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        title: `✅ Đã xong: ${prod?.name || 'Sản phẩm'} · ${order.color} · ${order.size} · ${doneQty} cái`,
        body: extra,
      }),
    }).catch(() => {});
  };

  // ── Hành động ──────────────────────────────────────────────
  const confirmDone = async () => {
    if (!confirmOrder) return;
    const ok = await updateOrder(confirmOrder.id, {
      status: 'done', remaining_quantity: 0,
      completed_at: new Date().toISOString(),
      completed_by: user?.name || 'Công nhân',
      is_read_by_admin: false,
    });
    if (ok) {
      showToast('✅ Đã hoàn thành đơn');
      notifyAdminDone(confirmOrder, confirmOrder.remaining_quantity, `Hoàn thành bởi ${user?.name || 'công nhân'}`);
    }
    setConfirmOrder(null);
  };

  const confirmPartial = async () => {
    if (!partialOrder) return;
    const left = Math.max(0, partialOrder.remaining_quantity - partialQty);
    const ok = await updateOrder(partialOrder.id, { remaining_quantity: left });
    if (ok) {
      showToast(`✅ Đã may ${partialQty} cái, còn lại ${left}`);
      notifyAdminDone(partialOrder, partialQty, `Xong một phần — còn lại ${left} cái`);
    }
    setPartialOrder(null);
  };

  const handlePin = async (order: Order) => {
    const ok = await updateOrder(order.id, { created_at: new Date().toISOString() } as Partial<Order>);
    if (ok) showToast('📌 Đã đưa đơn lên đầu');
  };

  const handleToggleUrgent = async (order: Order) => {
    const newPriority = order.priority === 'urgent' ? 'normal' : 'urgent';
    const ok = await updateOrder(order.id, { priority: newPriority });
    if (ok) showToast(newPriority === 'urgent' ? '🔥 Đã đánh dấu GẤP' : 'Đã bỏ đánh dấu GẤP');
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('orders').delete().eq('id', deleteConfirm.id);
    if (error) showToast('❌ Lỗi kết nối, thử lại');
    else { showToast('🗑 Đã xoá đơn'); await loadOrders(); }
    setDeleteConfirm(null);
  };

  const readAllNotifs = async () => {
    await supabase.from('orders').update({ is_read_by_admin: true }).eq('status', 'done').eq('is_read_by_admin', false);
    loadOrders();
  };

  const cardProps = {
    products, isAdmin,
    onDone: (o: Order) => setConfirmOrder(o),
    onPartial: (o: Order) => { setPartialOrder(o); setPartialQty(1); },
    onDelete: (o: Order) => setDeleteConfirm(o),
    onPin: handlePin,
    onToggleUrgent: handleToggleUrgent,
  };

  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        {/* ── Header ── */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>{isAdmin ? 'Đơn hàng' : 'Đơn cần may'}</h1>
            <div className="subtitle">
              Đang chờ: <b>{pending.length}</b> đơn
              {urgentCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · {urgentCount} 🔥 gấp</span>}
            </div>
          </div>
          {isAdmin ? (
            <BellButton onClick={() => setShowNotif(true)} count={unreadCount} />
          ) : (
            <button id="btn-refresh-worker" className="act-btn" onClick={manualRefresh} disabled={refreshing} style={{ minHeight: 40 }}>
              <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none', marginRight: 4 }}>🔄</span>
              {refreshing ? 'Đang tải' : 'Làm mới'}
            </button>
          )}
        </div>

        {/* ── Tabs (admin) ── */}
        {isAdmin && (
          <div className="mini-tabs" style={{ background: '#fff' }}>
            <button className={`mini-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')} id="tab-pending">
              Chờ may ({pending.length})
            </button>
            <button className={`mini-tab ${activeTab === 'done' ? 'active' : ''}`} onClick={() => setActiveTab('done')} id="tab-done">
              Đã xong ({doneOrders.length})
            </button>
          </div>
        )}
        <div className="mt-8" />

        {/* ── Danh sách ── */}
        {(!isAdmin || activeTab === 'pending') && (
          pending.length === 0
            ? <div className="empty-state"><div className="empty-icon">🎉</div>{isAdmin ? 'Không có đơn nào đang chờ!' : 'Không có đơn nào! Nghỉ ngơi chút 😊'}</div>
            : pending.map(o => <OrderCard key={o.id} order={o} {...cardProps} />)
        )}
        {isAdmin && activeTab === 'done' && (
          doneOrders.length === 0
            ? <div className="empty-state"><div className="empty-icon">📋</div>Chưa có đơn nào hoàn thành</div>
            : doneOrders.map(o => <DoneCard key={o.id} order={o} products={products} />)
        )}

        {/* ── Đã xong hôm nay (công nhân) ── */}
        {!isAdmin && doneToday.length > 0 && (
          <>
            <button className="collapse-toggle" onClick={() => setShowDoneToday(s => !s)}>
              {showDoneToday ? '▼' : '▶'} Đã xong hôm nay ({doneToday.length})
            </button>
            {showDoneToday && doneToday.map(o => <DoneCard key={o.id} order={o} products={products} />)}
          </>
        )}
      </div>

      {isAdmin && <button className="fab" id="fab-dat-hang" onClick={() => router.push('/tao-don')}>+</button>}
      <BottomNav />

      {/* ── Modals (dùng chung cho cả 2 vai trò) ── */}
      {showNotif && <NotifPanel orders={orders} products={products} onClose={() => setShowNotif(false)} onReadAll={readAllNotifs} />}

      {confirmOrder && (
        <div className="modal-overlay" onClick={() => setConfirmOrder(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Xác nhận hoàn thành</div>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              Đã may xong <b>{confirmOrder.remaining_quantity} cái {products[confirmOrder.product_id]?.name} · {confirmOrder.color} · {confirmOrder.size}</b>?
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmOrder(null)}>Huỷ</button>
              <button className="btn btn-success" id="btn-confirm-done" onClick={confirmDone}>✓ Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {partialOrder && (
        <div className="modal-overlay" onClick={() => setPartialOrder(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Xong một phần</div>
            <p style={{ fontSize: 15, marginBottom: 16, color: 'var(--text-secondary)' }}>
              {products[partialOrder.product_id]?.name} · {partialOrder.color} · {partialOrder.size} — Còn {partialOrder.remaining_quantity} cái
            </p>
            <div className="form-label">Số cái đã may xong:</div>
            <div className="qty-stepper" style={{ justifyContent: 'center', marginBottom: 20 }}>
              <button className="qty-btn" onClick={() => setPartialQty(Math.max(1, partialQty - 1))}>−</button>
              <input className="qty-input" type="number" value={partialQty} min={1} max={partialOrder.remaining_quantity - 1}
                onChange={e => setPartialQty(Math.min(partialOrder.remaining_quantity - 1, Math.max(1, +e.target.value)))} />
              <button className="qty-btn" onClick={() => setPartialQty(Math.min(partialOrder.remaining_quantity - 1, partialQty + 1))}>+</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, textAlign: 'center' }}>
              Còn lại: <b>{partialOrder.remaining_quantity - partialQty} cái</b>
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setPartialOrder(null)}>Huỷ</button>
              <button className="btn btn-primary" id="btn-confirm-partial" onClick={confirmPartial}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Xác nhận xoá</div>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              Xoá đơn <b>{products[deleteConfirm.product_id]?.name} · {deleteConfirm.color} · {deleteConfirm.size} · {deleteConfirm.remaining_quantity} cái</b>?
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Huỷ</button>
              <button className="btn btn-danger" id="btn-confirm-delete-order" onClick={confirmDelete}>🗑 Xoá</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
