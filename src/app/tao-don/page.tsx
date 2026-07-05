'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';
import { Category, Product, Order } from '@/lib/mockData';
import { getCategories, getProductsByCategory } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';

type Step = 'category' | 'product' | 'form' | 'success';

export default function TaoDonPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Dùng state thay vì URL params — tránh lỗi đồng bộ
  const [step, setStep] = useState<Step>('category');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selCatId, setSelCatId] = useState('');
  const [selProduct, setSelProduct] = useState<Product | null>(null);
  const [selSize, setSelSize] = useState('');
  const [selColor, setSelColor] = useState('');
  const [qty, setQty] = useState(5);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [dueOpt, setDueOpt] = useState<'none' | 'today' | 'tomorrow' | 'custom'>('none');
  const [note, setNote] = useState('');
  const [lastOrder, setLastOrder] = useState<{ product: Product; size: string; color: string; qty: number } | null>(null);

  // Load categories
  useEffect(() => {
    getCategories().then(cats => {
      console.log('[TaoDon] Categories loaded:', cats.length);
      setCategories(cats);
    }).catch(err => console.error('[TaoDon] Error loading categories:', err));
  }, []);

  // Load products khi chọn category
  const loadProductsByCat = (catId: string) => {
    setSelCatId(catId);
    setSelProduct(null);
    setSelSize('');
    setSelColor('');
    console.log('[TaoDon] Loading products for category:', catId);
    getProductsByCategory(catId).then(prods => {
      console.log('[TaoDon] Products loaded:', prods.length, prods.map(p => p.name));
      setProducts(prods);
      setStep('product');
    }).catch(err => {
      console.error('[TaoDon] Error loading products:', err);
      alert('Lỗi tải sản phẩm: ' + err.message);
    });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="app-shell">
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>Không có quyền truy cập</div>
        <BottomNav />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dueDate = dueOpt === 'today' ? today : dueOpt === 'tomorrow' ? tomorrow : null;

  const handleGuiDon = async () => {
    if (!selProduct || !selSize || !selColor) return;

    const newOrder: Order = {
      id: `o_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      product_id: selProduct.id,
      size: selSize, color: selColor, quantity: qty, remaining_quantity: qty,
      priority: priority, status: 'pending', due_date: dueDate,
      note: note.trim(), created_by: user.id,
      completed_at: null, completed_by: null, is_read_by_admin: true,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from('orders').insert(newOrder);
    if (insertError) {
      console.error('[TaoDon] ❌ Insert error:', insertError);
      alert('Lỗi khi tạo đơn: ' + insertError.message);
      return;
    }
    console.log('[TaoDon] ✅ Order created:', newOrder.id);
    setLastOrder({ product: selProduct, size: selSize, color: selColor, qty });
    setStep('success');
  };

  // ── SUCCESS ──
  if (step === 'success' && lastOrder) {
    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="success-page">
            <div className="success-icon">✅</div>
            <div className="success-title">Đã gửi đơn!</div>
            <div className="success-detail">
              {lastOrder.product.name}<br />
              {lastOrder.color} · {lastOrder.size} · {lastOrder.qty} cái<br />
              {priority === 'urgent' && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>🔥 GẤP</span>}
            </div>
            <div className="success-actions">
              <button className="btn btn-outline btn-full" id="btn-dat-them" onClick={() => {
                setSelSize(''); setSelColor(''); setQty(5); setNote('');
                setStep('form');
              }}>Đặt thêm (cùng sản phẩm)</button>
              <button className="btn btn-primary btn-full" id="btn-hoan-thanh-don" onClick={() => router.push('/don-hang')}>Hoàn thành</button>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── FORM ──
  if (step === 'form' && selProduct) {
    const cat = categories.find(c => c.id === selProduct.category_id);
    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('product')} style={{ padding: '8px', minHeight: 40 }}>‹</button>
            <div><h1 style={{ fontSize: 18 }}>Tạo đơn</h1><div className="subtitle">{selProduct.name}</div></div>
          </div>
          <div style={{ padding: '12px 16px 120px' }}>
            <div style={{ display: 'flex', gap: 12, padding: 14, background: '#fff', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
              <div className="order-thumb" style={{ background: cat?.color + '22' }}>{cat?.icon}</div>
              <div><div style={{ fontWeight: 700, fontSize: 16 }}>{selProduct.name}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cat?.name}</div></div>
            </div>
            <div className="form-group">
              <label className="form-label">Chọn size</label>
              <div className="pill-row">{selProduct.sizes.map(s => (<button key={s} className={`pill ${selSize === s ? 'selected' : ''}`} onClick={() => setSelSize(s)} id={`pill-size-${s}`}>{s}</button>))}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Chọn màu</label>
              <div className="pill-row">{selProduct.colors.map(c => (<button key={c} className={`pill ${selColor === c ? 'selected' : ''}`} onClick={() => setSelColor(c)} id={`pill-color-${c}`}>{c}</button>))}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Số lượng</label>
              <div className="qty-stepper">
                <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                <input className="qty-input" type="number" value={qty} min={1} onChange={e => setQty(Math.max(1, +e.target.value))} />
                <button className="qty-btn" onClick={() => setQty(q => q + 1)}>+</button>
                <span style={{ fontSize: 15, color: 'var(--text-secondary)', marginLeft: 4 }}>cái</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Ưu tiên</label>
              <div className="priority-toggle">
                <button className={`priority-opt ${priority === 'normal' ? 'selected-normal' : ''}`} onClick={() => setPriority('normal')} id="opt-normal">Bình thường</button>
                <button className={`priority-opt ${priority === 'urgent' ? 'selected-urgent' : ''}`} onClick={() => setPriority('urgent')} id="opt-urgent">🔥 GẤP</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Hạn cần xong</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([['none', 'Không có'], ['today', 'Hôm nay'], ['tomorrow', 'Ngày mai']] as const).map(([v, label]) => (
                  <button key={v} className={`pill ${dueOpt === v ? 'selected' : ''}`} onClick={() => setDueOpt(v)} id={`due-${v}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Ghi chú</label>
              <textarea className="form-input" rows={2} placeholder="VD: giao khách gấp..." value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'none' }} />
            </div>
          </div>
        </div>
        <div className="sticky-bottom">
          <button className="btn btn-primary btn-full btn-lg" id="btn-gui-don" onClick={handleGuiDon}
            disabled={!selSize || !selColor} style={{ opacity: (!selSize || !selColor) ? .5 : 1 }}>
            Gửi đơn
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── CHỌN SẢN PHẨM ──
  if (step === 'product') {
    const cat = categories.find(c => c.id === selCatId);
    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('category')} style={{ padding: '8px', minHeight: 40 }}>‹</button>
            <div><h1 style={{ fontSize: 18 }}>Chọn sản phẩm</h1><div className="subtitle">{cat?.icon} {cat?.name} · {products.length} SP</div></div>
          </div>
          <div>
            {products.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📦</div>Chưa có sản phẩm nào trong danh mục này</div>
            ) : (
              products.map(p => (
                <div key={p.id} className="product-row" id={`product-row-${p.id}`}
                  onClick={() => { setSelProduct(p); setStep('form'); }}>
                  <div className="product-thumb">{cat?.icon || '👔'}</div>
                  <div className="product-name">{p.name}</div>
                  <span className="chevron">›</span>
                </div>
              ))
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── CHỌN DANH MỤC ──
  return (
    <div className="app-shell">
      <div className="page-content">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/don-hang')} style={{ padding: '8px', minHeight: 40 }}>‹</button>
          <h1 style={{ fontSize: 18 }}>Đặt hàng</h1>
        </div>
        <div className="cat-grid">
          {categories.map(cat => (
            <button key={cat.id} className="cat-card" id={`cat-card-${cat.id}`}
              style={{ borderColor: cat.color }}
              onClick={() => loadProductsByCat(cat.id)}>
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-name">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}