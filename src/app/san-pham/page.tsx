'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';
import { MOCK_CATEGORIES, MOCK_PRODUCTS, loadProducts, Product, Category, ProductVariant, saveProductsToStorage } from '@/lib/mockData';

// ── FORM TẠO / SỬA SẢN PHẨM ────────────────────────────────────
function ProductForm({
  catId,
  product,
  onSave,
  onCancel,
}: {
  catId: string;
  product?: Product;
  onSave: (p: Partial<Product> & { imageFile?: File; variantFiles: Record<string, File> }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [active, setActive] = useState(product?.active ?? true);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(product?.main_image_url ?? null);
  const [mainImageFile, setMainImageFile] = useState<File | undefined>();
  const mainFileRef = useRef<HTMLInputElement>(null);

  const [colors, setColors] = useState<string[]>(product?.colors ?? []);
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [customColor, setCustomColor] = useState('');
  const [customSize, setCustomSize] = useState('');

  // Lịch sử variants để giữ lại ảnh khi thêm size/màu mới
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [variantFiles, setVariantFiles] = useState<Record<string, File>>({}); // variantId -> file
  const [variantPreviews, setVariantPreviews] = useState<Record<string, string>>({}); // variantId -> base64

  // Tự động sinh variants mỗi khi colors hoặc sizes thay đổi
  useEffect(() => {
    if (colors.length === 0 || sizes.length === 0) {
      setVariants([]);
      return;
    }
    const newVariants: ProductVariant[] = [];
    colors.forEach(c => {
      sizes.forEach(s => {
        // Tìm xem đã có variant này chưa
        const existing = variants.find(v => v.color === c && v.size === s);
        if (existing) {
          newVariants.push(existing);
        } else {
          newVariants.push({
            id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            color: c,
            size: s,
            image_url: null,
            current_quantity: 0,
            note: '',
          });
        }
      });
    });
    setVariants(newVariants);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, sizes]);

  const addColor = () => {
    const col = customColor.trim();
    if (col && !colors.includes(col)) setColors(prev => [...prev, col]);
    setCustomColor('');
  };

  const removeColor = (col: string) => setColors(prev => prev.filter(c => c !== col));

  const addSize = () => {
    const sz = customSize.trim();
    if (sz && !sizes.includes(sz)) setSizes(prev => [...prev, sz]);
    setCustomSize('');
  };

  const removeSize = (sz: string) => setSizes(prev => prev.filter(s => s !== sz));

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMainImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setMainImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleVariantImageChange = (variantId: string, file: File) => {
    setVariantFiles(prev => ({ ...prev, [variantId]: file }));
    const reader = new FileReader();
    reader.onload = ev => setVariantPreviews(prev => ({ ...prev, [variantId]: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const updateVariantNote = (id: string, note: string) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, note } : v));
  };

  const handleSave = () => {
    if (!name.trim()) return alert('Vui lòng nhập tên sản phẩm');
    if (colors.length === 0) return alert('Vui lòng thêm ít nhất 1 màu');
    if (sizes.length === 0) return alert('Vui lòng thêm ít nhất 1 size');
    
    // Gắn preview tạm cho variant (trên thực tế sẽ up server và lấy URL)
    const finalVariants = variants.map(v => ({
      ...v,
      image_url: variantPreviews[v.id] || v.image_url
    }));

    onSave({
      name: name.trim(),
      category_id: catId,
      description,
      colors,
      sizes,
      variants: finalVariants,
      active,
      main_image_url: mainImagePreview,
      imageFile: mainImageFile,
      variantFiles,
    });
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ── THÔNG TIN CHUNG ── */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: 12, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>1. Thông tin chung</h3>
        
        <div className="form-group">
          <label className="form-label">Tên sản phẩm <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            className="form-input"
            placeholder="VD: Áo thun basic, Váy xoè..."
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Ảnh đại diện</label>
          <div
            onClick={() => mainFileRef.current?.click()}
            style={{
              border: '2px dashed var(--border)', borderRadius: 12,
              padding: mainImagePreview ? 0 : '24px 16px',
              textAlign: 'center', cursor: 'pointer',
              overflow: 'hidden', minHeight: 120,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#FAFAFA',
            }}
          >
            {mainImagePreview
              ? <img src={mainImagePreview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: '#eee' }} />
              : (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Bấm để chọn ảnh chính</div>
                </div>
              )
            }
          </div>
          <input ref={mainFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMainImageChange} />
          {mainImagePreview && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 8, color: 'var(--danger)' }}
              onClick={() => { setMainImagePreview(null); setMainImageFile(undefined); }}
            >
              🗑 Xoá ảnh chính
            </button>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Mô tả ngắn</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="VD: Vải cotton 100%, thoáng mát..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>
      </div>

      {/* ── THUỘC TÍNH SẢN PHẨM ── */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: 12, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>2. Phân loại hàng</h3>
        
        {/* Màu sắc */}
        <div className="form-group">
          <label className="form-label">Màu sắc <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {colors.map(c => (
              <div key={c} style={{ background: '#f0f0f0', padding: '4px 8px 4px 12px', borderRadius: 100, display: 'flex', alignItems: 'center', fontSize: 14 }}>
                {c}
                <button onClick={() => removeColor(c)} style={{ border: 'none', background: 'none', marginLeft: 6, color: '#999', fontSize: 16, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              style={{ marginBottom: 0 }}
              placeholder="VD: Đen, Trắng, Đỏ..."
              value={customColor}
              onChange={e => setCustomColor(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addColor()}
            />
            <button className="btn btn-outline" onClick={addColor} style={{ flexShrink: 0 }}>+ Thêm</button>
          </div>
        </div>

        {/* Size */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Size <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {sizes.map(s => (
              <div key={s} style={{ background: '#f0f0f0', padding: '4px 8px 4px 12px', borderRadius: 100, display: 'flex', alignItems: 'center', fontSize: 14 }}>
                {s}
                <button onClick={() => removeSize(s)} style={{ border: 'none', background: 'none', marginLeft: 6, color: '#999', fontSize: 16, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              style={{ marginBottom: 0 }}
              placeholder="VD: S, M, L, Freesize..."
              value={customSize}
              onChange={e => setCustomSize(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSize()}
            />
            <button className="btn btn-outline" onClick={addSize} style={{ flexShrink: 0 }}>+ Thêm</button>
          </div>
        </div>
      </div>

      {/* ── DANH SÁCH BIẾN THỂ (VARIANTS) ── */}
      {variants.length > 0 && (
        <div style={{ background: '#fff', padding: '16px', borderRadius: 12, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>3. Danh sách phân loại ({variants.length})</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {variants.map((v, i) => {
              const fileInputId = `var-img-${v.id}`;
              const preview = variantPreviews[v.id] || v.image_url;
              return (
                <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* Cột Ảnh */}
                  <label htmlFor={fileInputId} style={{ 
                    width: 60, height: 60, borderRadius: 8, border: '1px dashed #ccc', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: preview ? 'transparent' : '#fafafa', cursor: 'pointer', flexShrink: 0,
                    overflow: 'hidden'
                  }}>
                    {preview 
                      ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> 
                      : <span style={{ fontSize: 20, color: '#aaa' }}>📷</span>}
                  </label>
                  <input 
                    id={fileInputId} 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={e => {
                      if (e.target.files?.[0]) handleVariantImageChange(v.id, e.target.files[0]);
                    }} 
                  />
                  
                  {/* Thông tin */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 600 }}>{v.color} - {v.size}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>SL: {v.current_quantity}</div>
                  </div>
                  
                  {/* Ghi chú */}
                  <input 
                    className="form-input"
                    style={{ width: 100, marginBottom: 0, padding: '4px 8px', fontSize: 13, height: 32 }}
                    placeholder="Ghi chú..."
                    value={v.note}
                    onChange={e => updateVariantNote(v.id, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trạng thái */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Trạng thái</label>
          <div className="priority-toggle" style={{ maxWidth: 280 }}>
            <button
              className={`priority-opt ${active ? 'selected-normal' : ''}`}
              onClick={() => setActive(true)}
            >
              ✅ Đang SX
            </button>
            <button
              className={`priority-opt ${!active ? 'selected-urgent' : ''}`}
              onClick={() => setActive(false)}
            >
              ⏸ Tạm dừng
            </button>
          </div>
        </div>
      </div>

      {/* Nút lưu */}
      <div className="sticky-bottom" style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel}>
          Huỷ
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 2 }}
          onClick={handleSave}
          disabled={!name.trim() || colors.length === 0 || sizes.length === 0}
        >
          💾 Lưu sản phẩm
        </button>
      </div>
    </div>
  );
}
// ── MAIN PAGE ────────────────────────────────────────────────────
type View = 'categories' | 'products' | 'product-detail' | 'add-product' | 'edit-product';

function DanhMucContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = (searchParams.get('view') as View) || 'categories';
  const selCatId = searchParams.get('cat') || '';
  const selProdId = searchParams.get('prod') || '';

  const [products, setProducts] = useState<Product[]>(() => [...MOCK_PRODUCTS]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Load products từ localStorage (đảm bảo xoá không bị reset sau F5)
  useEffect(() => {
    setProducts(loadProducts());
    window.addEventListener('productsUpdated', () => setProducts(loadProducts()));
    return () => {};
  }, []);

  const selCat = MOCK_CATEGORIES.find(c => c.id === selCatId) || null;
  const selProduct = products.find(p => p.id === selProdId) || null;

  const navigateTo = (newView: View, catId?: string, prodId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    if (catId) params.set('cat', catId);
    else params.delete('cat');
    if (prodId) params.set('prod', prodId);
    else params.delete('prod');
    router.push(`?${params.toString()}`);
  };

  const getProductsByCat = (catId: string) =>
    products.filter(p => p.category_id === catId && p.active);

  const handleSaveProduct = (data: Partial<Product> & { imageFile?: File; variantFiles?: Record<string, File> }) => {
    const newProd: Product = {
      id: `p_${Date.now()}`,
      category_id: selCat?.id ?? '',
      name: data.name ?? '',
      main_image_url: data.main_image_url ?? null,
      description: data.description ?? '',
      colors: data.colors ?? [],
      sizes: data.sizes ?? [],
      variants: data.variants ?? [],
      active: data.active ?? true,
    };
    // Thêm vào đầu danh sách để dễ nhìn thấy
    const newProducts = [newProd, ...products];
    setProducts(newProducts);
    saveProductsToStorage(newProducts); // Lưu vào localStorage để tránh mất khi F5
    setSavedMsg(`✅ Đã lưu "${newProd.name}"`);
    navigateTo('products', selCat?.id);
    setTimeout(() => setSavedMsg(''), 3000);
  };

  // ─── VIEW: Tạo sản phẩm ──────────────────────────────────────
  if (view === 'add-product' && selCat) {
    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigateTo('products', selCat.id)} style={{ padding: 8, minHeight: 40 }}>‹</button>
            <div>
              <h1 style={{ fontSize: 18 }}>Thêm sản phẩm</h1>
              <div className="subtitle">{selCat.icon} {selCat.name}</div>
            </div>
          </div>
          <div style={{ padding: '12px' }}>
            <ProductForm
              catId={selCat.id}
              onSave={handleSaveProduct}
              onCancel={() => navigateTo('products', selCat.id)}
            />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── VIEW: Chi tiết sản phẩm ─────────────────────────────────
  if (view === 'product-detail' && selProduct) {
    const cat = MOCK_CATEGORIES.find(c => c.id === selProduct.category_id);
    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigateTo('products', selCat?.id)} style={{ padding: 8, minHeight: 40 }}>‹</button>
            <div>
              <h1 style={{ fontSize: 18 }}>{selProduct.name}</h1>
              <div className="subtitle">{cat?.name}</div>
            </div>
          </div>
          <div style={{ padding: '16px 16px 100px' }}>
            <div style={{
              width: '100%', height: 220, borderRadius: 16,
              background: (cat?.color ?? '#4A90D9') + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 72, marginBottom: 20, overflow: 'hidden',
            }}>
              {selProduct.main_image_url
                ? <img src={selProduct.main_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : cat?.icon}
            </div>

            {selProduct.description && (
              <div className="form-group">
                <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{selProduct.description}</div>
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: '#f5f5f5', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Màu sắc</div>
                <div style={{ fontWeight: 600 }}>{selProduct.colors.join(', ')}</div>
              </div>
              <div style={{ flex: 1, background: '#f5f5f5', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Size</div>
                <div style={{ fontWeight: 600 }}>{selProduct.sizes.join(', ')}</div>
              </div>
            </div>

            <div className="form-group">
              <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Phân loại hàng</span>
                <span className={`badge ${selProduct.active ? 'badge-done' : 'badge-pending'}`}>
                  {selProduct.active ? '✅ Đang sản xuất' : '⏸ Tạm dừng'}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selProduct.variants.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                     <div style={{ 
                        width: 40, height: 40, borderRadius: 6, background: '#eee', 
                        marginRight: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                     }}>
                        {v.image_url ? <img src={v.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover'}}/> : <span style={{fontSize: 16, color: '#aaa'}}>📷</span>}
                     </div>
                     <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{v.color} - {v.size}</div>
                        {v.note && <div style={{ fontSize: 12, color: '#999' }}>📝 {v.note}</div>}
                     </div>
                     <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đã may</div>
                        <div style={{ fontWeight: 700 }}>{v.current_quantity}</div>
                     </div>
                  </div>
                ))}
              </div>
            </div>

            {user?.role === 'admin' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
                <button className="btn btn-outline btn-full" id="btn-edit-product">✏️ Sửa (Sắp ra mắt)</button>
                <button className="btn btn-danger btn-full" id="btn-delete-product"
                  onClick={() => {
                    const newProducts = products.filter(p => p.id !== selProduct.id);
                    setProducts(newProducts);
                    saveProductsToStorage(newProducts); // Xóa khỏi localStorage
                    navigateTo('products', selCat?.id);
                  }}>
                  🗑 Xóa
                </button>
              </div>
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── VIEW: Danh sách sản phẩm theo danh mục ──────────────────
  if (view === 'products' && selCat) {
    const allProds = getProductsByCat(selCat.id);
    const q = searchQ.toLowerCase().trim();
    const prods = q ? allProds.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.colors.some(c => c.toLowerCase().includes(q)) ||
      p.sizes.some(s => s.toLowerCase().includes(q))
    ) : allProds;
    return (
      <div className="app-shell">
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { navigateTo('categories'); setSearchQ(''); }} style={{ padding: 8, minHeight: 40 }}>‹</button>
              <div>
                <h1 style={{ fontSize: 18 }}>{selCat.icon} {selCat.name}</h1>
                <div className="subtitle">{allProds.length} sản phẩm</div>
              </div>
            </div>
            {user?.role === 'admin' && (
              <button
                className="btn btn-primary btn-sm"
                id="btn-them-san-pham"
                onClick={() => navigateTo('add-product', selCat.id)}
              >
                + Thêm SP
              </button>
            )}
          </div>

          <div style={{ padding: '0 12px 8px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
              <input
                className="form-input"
                style={{ paddingLeft: 38, marginBottom: 0 }}
                placeholder="Tìm tên, màu, size..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                id="input-search-product"
              />
              {searchQ && (
                <button
                  onClick={() => setSearchQ('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
                >✕</button>
              )}
            </div>
          </div>

          {savedMsg && (
            <div style={{ margin: '8px 12px', padding: '10px 14px', background: '#E8F5E9', borderRadius: 10, color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>
              {savedMsg}
            </div>
          )}

          {allProds.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              Chưa có sản phẩm nào
              {user?.role === 'admin' && (
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => navigateTo('add-product', selCat.id)} id="btn-them-dau-tien">
                    + Thêm sản phẩm đầu tiên
                  </button>
                </div>
              )}
            </div>
          ) : prods.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              Không tìm thấy sản phẩm nào với "{searchQ}"
            </div>
          ) : (
            prods.map(p => (
              <div key={p.id} className="product-row" id={`dm-product-${p.id}`}
                onClick={() => navigateTo('product-detail', selCat.id, p.id)}>
                <div className="product-thumb" style={{ background: (selCat.color) + '22', fontSize: 24 }}>
                  {p.main_image_url
                    ? <img src={p.main_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                    : selCat.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="product-name">{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {p.sizes.join(', ')} · {p.colors.slice(0, 3).join(', ')}
                    {p.colors.length > 3 ? `... +${p.colors.length - 3}` : ''}
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 18, color: 'var(--danger)', padding: '4px 8px',
                      borderRadius: 8, flexShrink: 0,
                    }}
                    title="Xoá sản phẩm"
                    id={`btn-delete-${p.id}`}
                  >🗑</button>
                )}
                <span className="chevron">›</span>
              </div>
            ))
          )}
        </div>
        <BottomNav />

        {/* Modal xác nhận xoá */}
        {deleteTarget && (
          <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Xác nhận xoá</div>
              <p style={{ fontSize: 16, lineHeight: 1.6 }}>
                Bạn có chắc muốn xoá sản phẩm <b>{deleteTarget.name}</b> không?
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
                Lịch sử sản lượng và đơn hàng cũ vẫn được giữ lại.
              </p>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>Huỷ</button>
                <button className="btn btn-danger" id="btn-confirm-delete" onClick={() => {
                  const newProducts = products.filter(p => p.id !== deleteTarget.id);
                  setProducts(newProducts);
                  saveProductsToStorage(newProducts);
                  setDeleteTarget(null);
                }}>🗑 Xoá</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── VIEW: Danh mục (mặc định) — với tìm kiếm nhanh ────────
  const allProducts = products.filter(p => p.active);
  const globalQ = searchQ.toLowerCase().trim();
  const globalResults = globalQ
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(globalQ) ||
        p.colors.some(c => c.toLowerCase().includes(globalQ)) ||
        p.sizes.some(s => s.toLowerCase().includes(globalQ))
      )
    : [];

  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1>Sản phẩm</h1>
          <button className="btn btn-ghost btn-sm" id="btn-dang-xuat" onClick={() => { logout(); router.push('/dang-nhap'); }}>
            🚪 Đăng xuất
          </button>
        </div>

        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            <input
              className="form-input"
              style={{ paddingLeft: 38, marginBottom: 0 }}
              placeholder="Tìm sản phẩm trong tất cả danh mục..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              id="input-search-global"
            />
            {searchQ && (
              <button
                onClick={() => setSearchQ('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
              >✕</button>
            )}
          </div>
        </div>

        {globalQ ? (
          globalResults.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              Không tìm thấy sản phẩm nào với &quot;{searchQ}&quot;
            </div>
          ) : (
            <>
              <div style={{ padding: '4px 14px 8px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {globalResults.length} kết quả
              </div>
              {globalResults.map(p => {
                const cat = MOCK_CATEGORIES.find(c => c.id === p.category_id);
                return (
                  <div key={p.id} className="product-row"
                    onClick={() => { navigateTo('product-detail', p.category_id, p.id); }}>
                    <div className="product-thumb" style={{ background: (cat?.color ?? '#4A90D9') + '22', fontSize: 24 }}>
                      {p.main_image_url
                        ? <img src={p.main_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
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
            {MOCK_CATEGORIES.map(cat => {
              const count = getProductsByCat(cat.id).length;
              return (
                <button key={cat.id} className="cat-card" id={`dm-cat-${cat.id}`}
                  style={{ borderColor: cat.color }}
                  onClick={() => { navigateTo('products', cat.id); }}>
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-name">{cat.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{count} sản phẩm</span>
                </button>
              );
            })}
            {user?.role === 'admin' && (
              <button className="cat-card" id="btn-them-danh-muc"
                style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
                onClick={() => setShowAddCat(true)}>
                <span style={{ fontSize: 28, color: 'var(--text-secondary)' }}>+</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700 }}>Thêm danh mục</span>
              </button>
            )}
          </div>
        )}
      </div>
      <BottomNav />

      {showAddCat && (
        <div className="modal-overlay" onClick={() => setShowAddCat(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Thêm danh mục mới</div>
            <div className="form-group">
              <label className="form-label">Tên danh mục</label>
              <input className="form-input" placeholder="VD: Quần, Áo khoác..." id="input-cat-name" />
            </div>
            <div className="form-group">
              <label className="form-label">Icon</label>
              <div className="pill-row">
                {['👔','👗','🧥','👖','👙','🧣','👒','🎀','🧤'].map(ic => (
                  <button key={ic} className="pill" style={{ fontSize: 22 }}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Màu đại diện</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['#4A90D9','#E91E8C','#FF6B35','#2E7D32','#7B1FA2','#795548','#546E7A'].map(clr => (
                  <button key={clr} style={{ width: 36, height: 36, borderRadius: '50%', background: clr, border: '3px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowAddCat(false)}>Huỷ</button>
              <button className="btn btn-primary" id="btn-save-cat">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DanhMucPage() {
  return (
    <Suspense fallback={<div className="app-shell"><div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Đang tải...</div></div>}>
      <DanhMucContent />
    </Suspense>
  );
}
