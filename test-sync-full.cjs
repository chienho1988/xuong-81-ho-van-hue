/**
 * Test E2E: Admin creates order -> Worker sees it immediately
 * Run: node test-sync-full.cjs
 */
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ovvndntcnoriodozxpau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dm5kbnRjbm9yaW9kb3p4cGF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzA0NzQsImV4cCI6MjA5ODgwNjQ3NH0.y5BD1ePodCgKu0lxlaLPn8yhMdqjJkTKu0GxqnesDL4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitFor(page, selector, timeout = 10000) {
  let elapsed = 0;
  while (elapsed < timeout) {
    const el = await page.$(selector);
    if (el) return el;
    await sleep(200);
    elapsed += 200;
  }
  return null;
}

async function seedData() {
  console.log('--- Seeding ---');
  await supabase.from('users').upsert([
    { id: 'u1', name: 'Chu xuong', role: 'admin', pin: '1234' },
    { id: 'u2', name: 'Cong nhan', role: 'worker', pin: '5678' },
  ]);
  await supabase.from('categories').upsert([
    { id: 'c1', name: 'Ao', icon: '\u{1F454}', color: '#4A90D9', sort_order: 1 },
  ]);
  await supabase.from('products').upsert([
    { id: 'p1', category_id: 'c1', name: 'Ao thun basic', colors: ['Den','Trang'], sizes: ['S','M','L'], active: true },
  ]);
  await supabase.from('product_variants').upsert([
    { id: 'v1', product_id: 'p1', color: 'Den', size: 'S' },
  ]);
  const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  console.log('Done. Orders:', count);
}

async function createOrder(page) {
  console.log('  /tao-don');
  await page.goto('http://localhost:3000/tao-don', { waitUntil: 'networkidle' });
  await sleep(1000);
  const cat = await waitFor(page, '.cat-card');
  if (!cat) return false;
  await cat.click();
  await sleep(2000);
  const prod = await waitFor(page, '.product-row');
  if (!prod) return false;
  await prod.click();
  await sleep(1000);
  const sz = await waitFor(page, '#pill-size-S');
  const cl = await waitFor(page, '#pill-color-Den');
  if (sz) await sz.click();
  if (cl) await cl.click();
  await sleep(200);
  const btn = await waitFor(page, '#btn-gui-don');
  if (!btn) return false;
  const d = await btn.isDisabled();
  if (d) return false;
  await btn.click();
  await sleep(1500);
  console.log('  OK');
  return true;
}

async function main() {
  await seedData();
  console.log('\n=== TEST ===');
  const browser = await chromium.launch({ headless: false });
  const ctxA = await browser.newContext();
  const ctxW = await browser.newContext();
  const a = await ctxA.newPage();
  const w = await ctxW.newPage();
  a.on('console', m => { const t = m.text(); if (t.includes('[TaoDon]') || t.includes('OK')) console.log('[a]', t); });
  w.on('console', m => { const t = m.text(); if (t.includes('[Orders]')) console.log('[w]', t); });
  
  console.log('1. Admin login...');
  await a.goto('http://localhost:3000/dang-nhap');
  await sleep(500);
  for (const c of '1234') { await a.click('#pin-btn-' + c); await sleep(30); }
  await a.click('#btn-login');
  await sleep(2000);
  
  console.log('2. Worker login...');
  await w.goto('http://localhost:3000/dang-nhap');
  await sleep(500);
  for (const c of '5678') { await w.click('#pin-btn-' + c); await sleep(30); }
  await w.click('#btn-login');
  await sleep(2000);
  
  console.log('3. Create order #1...');
  const ok = await createOrder(a);
  if (!ok) { console.log('FAILED'); await browser.close(); return; }
  
  console.log('4. Check worker...');
  await w.goto('http://localhost:3000/don-hang', { waitUntil: 'networkidle' });
  const result = await waitFor(w, '.empty-state, .card', 15000);
  console.log('  DOM loaded:', result ? 'yes' : 'timeout');
  const b = await w.textContent('body');
  // Worker view: đếm number of card elements = number of pending orders
  const cards = await w.$$('.card');
  const hasNoOrders = b.includes('Không có \u0111\u01a1n n\xe0o');
  console.log('  Worker cards:', cards.length);
  const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  console.log('  DB orders:', count);
  if (cards.length >= 1) console.log('  \u2705 WORKER SEES ORDER');
  else console.log('  \u274C EMPTY');
  
  console.log('5. Create order #2...');
  await createOrder(a);
  await sleep(3000);
  const cards2 = await w.$$('.card');
  console.log('  Worker cards after #2:', cards2.length);
  if (cards2.length >= 2) console.log('  REALTIME OK');
  
  console.log('\nDONE');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });