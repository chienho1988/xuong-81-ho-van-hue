'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { Category, Product, ProductionLog } from '@/lib/mockData';
import { getCategories, getProducts } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

type Step = 'category' | 'product' | 'form' | 'success';

function getFullVariants(product: Product) {
  return product.colors.flatMap(c =>
    product.sizes.map(s => {
      const existing = product.variants.find(v => v.color === c && v.size === s);
      return existing || {
        id: `v_temp_${c}_${s}`,
        color: c,
        size: s,
        image_url: null,
        current_quantity: 0,
        note: '',
      };
    })
  );
}

function SearchBox({
  value, onChange, placeholder = 'Tìm sản phẩm...', id = 'search-input',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; id?: string;
}) {
  return (
    <div style={{ padding: '0 12px 10px', position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 24, top: '50%',
        transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none',
      }}>🔍</span>
      <input
        id={id}
        className="form-input"
        style={{ paddingLeft: 40, marginBottom: 0 }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
      />
      {value && (
        <button onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 22, top: '50%',
            transform: 'translateY(-50%)', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)',
          }}>✕</button>
      )}
    </div>
  );
}

function NhapSanLuongContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const step = (searchParams.get('step') as Step) || 'category';
  const selCatId = searchParams.get('cat') || '';
  const selProductId = searchParams.get('prod') || '';

  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    setMounted(true);
    getCategories().then(setCategories);
    getProducts().then(setProducts);
  }, []);

  const selProduct = products.find(p => p.id === selProductId) || null;

  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});
  const [savedCount, setSavedCount] = useState(0);
  const [searchQ, setSearchQ] = useState('');

  const navigateTo = useCallback((newStep: Step, catId?: string, prodId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', newStep);
    if (catId) params.set('cat', catId);
    else if (newStep === 'category') params.delete('cat');
    if (prodId) params.set('prod', prodId);
    else if (newStep === 'category' || newStep === 'product') params.delete('prod');
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  const resetQtys = useCallback(() => setVariantQtys({}), []);

  const handleSave = async () => {
    if (!selProduct || !user) return;

    const fullVariants = getFullVariants(selProduct);
    const now = new Date();
    const logDate = now.toISOString().split('T')[0];

    const logs: ProductionLog[] = [];
    fullVariants.forEach(v => {
      const qty = variantQtys[v.id] || 0;
      if (qty <= 0) return;
      logs.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${v.id}`,
        product_id: selProduct.id,
        worker_id: user.id,
        order_id: null,
        log_date: logDate,
        size: v.size,
        color: v.color,
        quantity: qty,
        note: '',
        created_at: now.toISOString(),
      });
    });

    if (logs.length === 0) return;

    // Lưu vào Supabase
    const { error } = await supabase.from('production_logs').insert(logs);
    if (error) console.error('Lỗi lưu sản lượng:', error);

    setSavedCount(logs.length);
    resetQtys();
    navigateTo('success', selCatId, selProductId);
  };

  // ── SUCCESS ──
  if (step === 'success') {
    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="success-page">
            <div className="success-icon">✅</div>
            <div className="success-title">Đã lưu sản lượng!</div>
            <div className="success-detail"><b>{savedCount} dòng</b> đã được lưu thành công</div>
            <div className="success-actions">
              <button className="btn btn-outline btn-full" id="btn-luu-them"
                onClick={() => { resetQtys(); navigateTo('form', selCatId, selProductId); }}>Nhập thêm</button>
              <button className="btn btn-primary btn-full" id="btn-hoan-thanh-sl"
                onClick={() => router.push('/lich-su')}>Xem lịch sử</button>
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
    const fullVariants = getFullVariants(selProduct);
    const displayVariants = fullVariants.length > 0 ? fullVariants : selProduct.variants;

    const setQty = (variantId: string, val: number) => {
      setVariantQtys(prev => ({ ...prev, [variantId]: Math.max(0, val) }));
    };
    const hasAny = Object.values(variantQtys).some(q => q > 0);

    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetQtys(); navigateTo('product', selCatId); }} style={{ padding: 8, minHeight: 40 }}>‹</button>
            <div>
              <h1 style={{ fontSize: 18 }}>Nhập sản lượng</h1>
              <div className="subtitle">{selProduct.name}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 16px 8px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 16, background: (cat?.color ?? '#4A90D9') + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, margin: '0 auto 8px', overflow: 'hidden',
            }}>
              {selProduct.main_image_url
                ? <img src={selProduct.main_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : cat?.icon}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{selProduct.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{cat?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: '#f5f5f5', borderRadius: 8, padding: '4px 12px', display: 'inline-block' }}>
              {displayVariants.length} phân loại
            </div>
          </div>
          <div style={{ padding: '8px 16px 140px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayVariants.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14, textAlign: 'center', padding: 24 }}>
                Sản phẩm này chưa có phân loại nào.
              </div>
            ) : (
              displayVariants.map(v => {
                const qty = variantQtys[v.id] || 0;
                return (
                  <div key={v.id} style={{
                    display: 'flex', alignItems: 'center', padding: '10px 12px',
                    border: `1.5px solid ${qty > 0 ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 12, background: qty > 0 ? '#eef2ff' : '#fff',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 8, background: '#f5f5f5',
                      marginRight: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {v.image_url
                        ? <img src={v.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 18, color: '#ccc' }}>📷</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: qty > 0 ? 'var(--primary)' : 'inherit' }}>
                        {v.color} - {v.size}
                      </div>
                      {v.note && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>📝 {v.note}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setQty(v.id, qty - 1)}
                        style={{
                          width: 42, height: 42, borderRadius: '50%',
                          border: `2px solid ${qty > 0 ? 'var(--primary)' : 'var(--border)'}`,
                          background: qty > 0 ? '#e3f2fd' : '#fff',
                          fontSize: 22, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: qty > 0 ? 'var(--primary)' : '#ccc',
                        }}>−</button>
                      <input type="number" value={qty} min={0}
                        onChange={e => setQty(v.id, Math.max(0, +e.target.value || 0))}
                        style={{
                          width: 56, textAlign: 'center', fontSize: 20, fontWeight: 700,
                          border: `2px solid ${qty > 0 ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 8, padding: '6px 4px', outline: 'none',
                          MozAppearance: 'textfield',
                        }}
                        onFocus={e => e.target.select()} />
                      <button onClick={() => setQty(v.id, qty + 1)}
                        style={{
                          width: 42, height: 42, borderRadius: '50%',
                          border: '2px solid var(--primary)',
                          background: '#e3f2fd', fontSize: 22, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--primary)',
                        }}>+</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="sticky-bottom">
          <button className="btn btn-success btn-full btn-lg" id="btn-luu-san-luong"
            onClick={handleSave}
            disabled={!hasAny}
            style={{ opacity: hasAny ? 1 : .5 }}>
            {hasAny
              ? `📦 Lưu ${Object.values(variantQtys).reduce((a, b) => a + b, 0)} cái`
              : 'Lưu sản lượng (bấm + để nhập)'}
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── CHỌN SẢN PHẨM ──
  if (step === 'product') {
    const allProds = products.filter(p => p.category_id === selCatId && p.active);
    const cat = categories.find(c => c.id === selCatId);
    const q = searchQ.toLowerCase().trim();
    const filtered = q
      ? allProds.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.colors.some(c => c.toLowerCase().includes(q)) ||
        p.sizes.some(s => s.toLowerCase().includes(q))
      )
      : allProds;

    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { navigateTo('category'); setSearchQ(''); }}
              style={{ padding: 8, minHeight: 40 }}>‹</button>
            <div>
              <h1 style={{ fontSize: 18 }}>Chọn sản phẩm</h1>
              <div className="subtitle">{cat?.icon} {cat?.name} · {allProds.length} SP</div>
            </div>
          </div>
          <SearchBox value={searchQ} onChange={setSearchQ}
            placeholder={`Tìm trong ${cat?.name ?? ''}...`} id="search-product-in-cat" />
          {filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🔍</div>Không tìm thấy "{searchQ}"</div>
          ) : (
            filtered.map(p => (
              <div key={p.id} className="product-row" id={`sl-product-${p.id}`}
                onClick={() => { setSearchQ(''); resetQtys(); navigateTo('form', selCatId, p.id); }}>
                <div className="product-thumb" style={{ background: (cat?.color ?? '#4A90D9') + '22', fontSize: 22 }}>
                  {p.main_image_url
                    ? <img src={p.main_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                    : cat?.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="product-name">{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {p.sizes.join(', ')} · {p.colors.slice(0, 3).join(', ')}
                  </div>
                </div>
                <span className="chevron">›</span>
              </div>
            ))
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── DANH MỤC ──
  if (!mounted) {
    return <div className="app-shell"><div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}>
      <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Đang tải...</span>
    </div></div>;
  }

  const allActive = products.filter(p => p.active);
  const gQ = searchQ.toLowerCase().trim();
  const globalResults = gQ
    ? allActive.filter(p =>
      p.name.toLowerCase().includes(gQ) ||
      p.colors.some(c => c.toLowerCase().includes(gQ)) ||
      p.sizes.some(s => s.toLowerCase().includes(gQ))
    )
    : [];

  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        <div className="page-header">
          <h1>Nhập sản lượng</h1>
          <div className="subtitle">Chọn loại hàng cần ghi</div>
        </div>
        <SearchBox value={searchQ} onChange={setSearchQ}
          placeholder="Tìm nhanh sản phẩm bất kỳ..." id="search-sl-global" />
        {gQ ? (
          globalResults.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🔍</div>Không tìm thấy sản phẩm "{searchQ}"</div>
          ) : (
            <>
              <div style={{ padding: '4px 14px 8px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {globalResults.length} kết quả
              </div>
              {globalResults.map(p => {
                const cat = categories.find(c => c.id === p.category_id);
                return (
                  <div key={p.id} className="product-row" id={`sl-search-${p.id}`}
                    onClick={() => { setSearchQ(''); resetQtys(); navigateTo('form', p.category_id, p.id); }}>
                    <div className="product-thumb" style={{ background: (cat?.color ?? '#4A90D9') + '22', fontSize: 22 }}>
                      {p.main_image_url
                        ? <img src={p.main_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                        : cat?.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="product-name">{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {cat?.icon} {cat?.name} · {p.sizes.join(', ')}
                      </div>
                    </div>
                    <span className="chevron">›</span>
                  </div>
                );
              })}
            </>
          )
        ) : (
          <div className="cat-grid">
            {categories.map(cat => {
              const count = products.filter(p => p.category_id === cat.id && p.active).length;
              return (
                <button key={cat.id} className="cat-card" id={`sl-cat-${cat.id}`}
                  style={{ borderColor: cat.color }}
                  onClick={() => { navigateTo('product', cat.id); }}>
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-name">{cat.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{count} SP</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

export default function NhapSanLuongPage() {
  return (
    <Suspense fallback={<div className="app-shell"><div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Đang tải...</div></div>}>
      <NhapSanLuongContent />
    </Suspense>
  );
}