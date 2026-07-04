// Dữ liệu mẫu cho Phase 1 (không kết nối backend)
// QUAN TRỌNG: Không dùng new Date() / Date.now() / Math.random() ở module level
// để tránh Hydration Error. Tất cả dữ liệu phải có giá trị cố định.
//
// LƯU Ý VỀ ĐỒNG BỘ: localStorage chỉ đồng bộ trong cùng trình duyệt/máy.
// Muốn admin và công nhân dùng 2 thiết bị khác nhau (điện thoại worker + máy tính admin)
// thì cần chuyển orders sang Supabase hoặc Firebase Firestore.
// Bản hiện tại dùng localStorage + window event 'ordersUpdated' để đồng bộ giữa các tab
// trong cùng một trình duyệt.

export type Role = 'admin' | 'worker';

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  color: string;
  size: string;
  image_url: string | null;
  current_quantity: number;
  note: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  main_image_url: string | null;
  description: string;
  colors: string[];
  sizes: string[];
  variants: ProductVariant[];
  active: boolean;
}

export interface Order {
  id: string;
  product_id: string;
  size: string;
  color: string;
  quantity: number;
  remaining_quantity: number;
  priority: 'normal' | 'urgent';
  status: 'pending' | 'done';
  due_date: string | null;
  note: string;
  created_by: string;
  completed_at: string | null;
  completed_by: string | null;   // tên công nhân hoàn thành
  is_read_by_admin: boolean;      // admin đã đọc thông báo chưa
  created_at: string;
}

export interface ProductionLog {
  id: string;
  product_id: string;
  worker_id: string;
  order_id: string | null;
  log_date: string;
  size: string;
  color: string;
  quantity: number;
  note: string;
  created_at: string;
}

// ===== DỮ LIỆU MẪU =====
// Tất cả ID và ngày tháng đều là giá trị cố định

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Chủ xưởng', role: 'admin', pin: '1234' },
  { id: 'u2', name: 'Ngọc (Công nhân)', role: 'worker', pin: '5678' },
];

export const MOCK_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Áo', icon: '👔', color: '#4A90D9', sort_order: 1 },
  { id: 'c2', name: 'Váy', icon: '👗', color: '#E91E8C', sort_order: 2 },
  { id: 'c3', name: 'Set', icon: '🧥', color: '#7B1FA2', sort_order: 3 },
  { id: 'c4', name: 'Quần', icon: '👖', color: '#795548', sort_order: 4 },
  { id: 'c5', name: 'Khác', icon: '🧺', color: '#546E7A', sort_order: 5 },
];

// ── PRODUCTS ──────────────────────────────────────────────────────
export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    category_id: 'c1',
    name: 'Áo thun basic',
    main_image_url: null,
    sizes: ['S', 'M', 'L'],
    colors: ['Đen', 'Trắng'],
    description: 'Áo thun cotton thoáng mát',
    variants: [
      { id: 'v1', color: 'Đen', size: 'S', image_url: null, current_quantity: 0, note: '' },
      { id: 'v2', color: 'Đen', size: 'M', image_url: null, current_quantity: 0, note: '' },
      { id: 'v3', color: 'Đen', size: 'L', image_url: null, current_quantity: 0, note: '' },
      { id: 'v4', color: 'Trắng', size: 'S', image_url: null, current_quantity: 0, note: '' },
      { id: 'v5', color: 'Trắng', size: 'M', image_url: null, current_quantity: 0, note: '' },
      { id: 'v6', color: 'Trắng', size: 'L', image_url: null, current_quantity: 0, note: '' },
    ],
    active: true,
  },
  {
    id: 'p2',
    category_id: 'c1',
    name: 'Áo sơ mi công sở',
    main_image_url: null,
    sizes: ['M', 'L'],
    colors: ['Trắng', 'Xanh'],
    description: 'Vải lụa cao cấp',
    variants: [
      { id: 'v7', color: 'Trắng', size: 'M', image_url: null, current_quantity: 0, note: '' },
      { id: 'v8', color: 'Trắng', size: 'L', image_url: null, current_quantity: 0, note: '' },
      { id: 'v9', color: 'Xanh', size: 'M', image_url: null, current_quantity: 0, note: '' },
      { id: 'v10', color: 'Xanh', size: 'L', image_url: null, current_quantity: 0, note: '' },
    ],
    active: true,
  },
  {
    id: 'p3',
    category_id: 'c2',
    name: 'Váy chữ A',
    main_image_url: null,
    sizes: ['Freesize', 'S', 'M'],
    colors: ['Đen', 'Trắng', 'Đỏ'],
    description: '',
    variants: [
      { id: 'v11', color: 'Đen', size: 'Freesize', image_url: null, current_quantity: 0, note: '' },
      { id: 'v12', color: 'Trắng', size: 'S', image_url: null, current_quantity: 0, note: '' },
    ],
    active: true,
  },
  {
    id: 'p4',
    category_id: 'c2',
    name: 'Váy maxi dài',
    main_image_url: null,
    sizes: ['Freesize'],
    colors: ['Đen', 'Be', 'Đỏ'],
    description: 'Vải lụa mỏng',
    variants: [
      { id: 'v13', color: 'Đen', size: 'Freesize', image_url: null, current_quantity: 0, note: '' },
    ],
    active: true,
  },
  {
    id: 'p5',
    category_id: 'c3',
    name: 'Set áo + quần',
    main_image_url: null,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Đen', 'Trắng', 'Be'],
    description: '',
    variants: [],
    active: true,
  },
  {
    id: 'p6',
    category_id: 'c3',
    name: 'Set váy + áo khoác',
    main_image_url: null,
    sizes: ['Freesize', 'S', 'M'],
    colors: ['Đen', 'Trắng', 'Hồng'],
    description: '',
    variants: [],
    active: true,
  },
  {
    id: 'p7',
    category_id: 'c4',
    name: 'Quần tây',
    main_image_url: null,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Đen', 'Xám', 'Be'],
    description: '',
    variants: [],
    active: true,
  },
  {
    id: 'p8',
    category_id: 'c4',
    name: 'Quần short',
    main_image_url: null,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Đen', 'Trắng', 'Xanh'],
    description: '',
    variants: [],
    active: true,
  },
  {
    id: 'p9',
    category_id: 'c5',
    name: 'Khăn / Phụ kiện',
    main_image_url: null,
    sizes: ['Freesize'],
    colors: ['Đen', 'Trắng', 'Be', 'Hồng'],
    description: '',
    variants: [],
    active: true,
  },
];

// ── PRODUCTION LOGS MẪU ──────────────────────────────────────────
export const MOCK_PRODUCTION_LOGS: ProductionLog[] = [
  {
    id: 'l1',
    product_id: 'p4',
    worker_id: 'u2',
    order_id: 'o4',
    log_date: 'TODAY',
    size: 'Freesize',
    color: 'Đen',
    quantity: 3,
    note: '',
    created_at: 'TODAY',
  },
  {
    id: 'l2',
    product_id: 'p1',
    worker_id: 'u2',
    order_id: null,
    log_date: 'TODAY',
    size: 'L',
    color: 'Trắng',
    quantity: 7,
    note: 'May thêm hàng tồn',
    created_at: 'TODAY',
  },
  {
    id: 'l3',
    product_id: 'p3',
    worker_id: 'u2',
    order_id: null,
    log_date: 'YESTERDAY',
    size: 'M',
    color: 'Đen',
    quantity: 5,
    note: '',
    created_at: 'YESTERDAY',
  },
];

// ── ORDERS MẪU ───────────────────────────────────────────────────
export const MOCK_ORDERS: Order[] = [
  {
    id: 'o1',
    product_id: 'p1',
    size: 'M',
    color: 'Đen',
    quantity: 10,
    remaining_quantity: 10,
    priority: 'urgent',
    status: 'pending',
    due_date: 'TODAY',
    note: 'Giao khách gấp',
    created_by: 'u1',
    completed_at: null,
    completed_by: null,
    is_read_by_admin: true,
    created_at: 'TODAY_07:30',
  },
  {
    id: 'o2',
    product_id: 'p3',
    size: 'S',
    color: 'Trắng',
    quantity: 5,
    remaining_quantity: 5,
    priority: 'normal',
    status: 'pending',
    due_date: null,
    note: '',
    created_by: 'u1',
    completed_at: null,
    completed_by: null,
    is_read_by_admin: true,
    created_at: 'TODAY_08:00',
  },
  {
    id: 'o3',
    product_id: 'p2',
    size: 'L',
    color: 'Trắng',
    quantity: 8,
    remaining_quantity: 8,
    priority: 'urgent',
    status: 'pending',
    due_date: null,
    note: '',
    created_by: 'u1',
    completed_at: null,
    completed_by: null,
    is_read_by_admin: true,
    created_at: 'TODAY_09:15',
  },
  {
    id: 'o4',
    product_id: 'p4',
    size: 'Freesize',
    color: 'Đen',
    quantity: 3,
    remaining_quantity: 0,
    priority: 'normal',
    status: 'done',
    due_date: null,
    note: '',
    created_by: 'u1',
    completed_at: 'TODAY_11:20',
    completed_by: 'Ngọc (Công nhân)',
    is_read_by_admin: true,
    created_at: 'TODAY_07:00',
  },
];

// ── HÀM TIỆN ÍCH: thay thế placeholder TODAY/YESTERDAY ───────────
function replaceDatePlaceholders<T>(data: T): T {
  if (typeof data === 'string') {
    if (data === 'TODAY') return new Date().toISOString().split('T')[0] as unknown as T;
    if (data === 'YESTERDAY') return new Date(Date.now() - 86400000).toISOString().split('T')[0] as unknown as T;
    if (data.startsWith('TODAY_')) {
      const time = data.slice(6);
      return `${new Date().toISOString().split('T')[0]}T${time}:00` as unknown as T;
    }
    return data;
  }
  if (Array.isArray(data)) return data.map(item => replaceDatePlaceholders(item)) as unknown as T;
  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(data as Record<string, unknown>)) {
      result[key] = replaceDatePlaceholders((data as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  return data;
}

// ── LOCALSTORAGE HELPERS ─────────────────────────────────────────
export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, data: unknown) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

function dispatchEvent(name: string) {
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new Event(name)); } catch (e) {}
  }
}

// ── PRODUCTS ──────────────────────────────────────────────────────
export function loadProducts(): Product[] {
  const saved = loadFromStorage<Product[]>('xuong81_products', []);
  if (saved.length > 0) {
    MOCK_PRODUCTS.length = 0;
    MOCK_PRODUCTS.push(...saved);
    return saved;
  }
  const seeded = replaceDatePlaceholders(MOCK_PRODUCTS);
  saveToStorage('xuong81_products', seeded);
  return seeded;
}

export function saveProductsToStorage(products: Product[]) {
  saveToStorage('xuong81_products', products);
  MOCK_PRODUCTS.length = 0;
  MOCK_PRODUCTS.push(...products);
  dispatchEvent('productsUpdated');
}

// ── PRODUCTION LOGS ───────────────────────────────────────────────
export function loadProductionLogs(): ProductionLog[] {
  const saved = loadFromStorage<ProductionLog[]>('xuong81_production_logs', []);
  if (saved.length > 0) {
    MOCK_PRODUCTION_LOGS.length = 0;
    MOCK_PRODUCTION_LOGS.push(...saved);
    return saved;
  }
  const seeded = replaceDatePlaceholders(MOCK_PRODUCTION_LOGS);
  saveToStorage('xuong81_production_logs', seeded);
  return seeded;
}

export function saveProductionLogsToStorage(logs: ProductionLog[]) {
  saveToStorage('xuong81_production_logs', logs);
  MOCK_PRODUCTION_LOGS.length = 0;
  MOCK_PRODUCTION_LOGS.push(...logs);
  dispatchEvent('productionLogsUpdated');
}

export function addProductionLog(log: ProductionLog) {
  const current = loadProductionLogs();
  const newLogs = [log, ...current];
  saveProductionLogsToStorage(newLogs);
  return newLogs;
}

export function addMultipleProductionLogs(logs: ProductionLog[]) {
  const current = loadProductionLogs();
  const newLogs = [...logs, ...current];
  saveProductionLogsToStorage(newLogs);
  return newLogs;
}

// ── ORDERS ────────────────────────────────────────────────────────
export function loadOrders(): Order[] {
  const saved = loadFromStorage<Order[]>('xuong81_orders', []);
  if (saved.length > 0) return saved;
  // Lần đầu: seed dữ liệu mẫu
  const seeded = replaceDatePlaceholders(MOCK_ORDERS);
  saveToStorage('xuong81_orders', seeded);
  return seeded;
}

export function saveOrdersToStorage(orders: Order[]) {
  saveToStorage('xuong81_orders', orders);
  dispatchEvent('ordersUpdated');
}

// ── HELPERS ───────────────────────────────────────────────────────
export function getProductById(id: string): Product | undefined {
  return MOCK_PRODUCTS.find(p => p.id === id);
}

export function getCategoryById(id: string): Category | undefined {
  return MOCK_CATEGORIES.find(c => c.id === id);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return MOCK_PRODUCTS.filter(p => p.category_id === categoryId && p.active);
}