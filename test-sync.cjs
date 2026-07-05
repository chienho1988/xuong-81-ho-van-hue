/**
 * Test E2E: Admin tạo đơn → Worker thấy ngay
 * Chạy: node test-sync.cjs
 * (dùng require thay vì import để tương thích)
 */
const { chromium } = require('playwright');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== TEST ORDER SYNC ===');
  console.log('Launching browser...');
  
  const browser = await chromium.launch({ headless: true });

  // 2 context riêng biệt (2 phiên riêng, không share session)
  const ctxAdmin = await browser.newContext();
  const ctxWorker = await browser.newContext();

  const adminPage = await ctxAdmin.newPage();
  const workerPage = await ctxWorker.newPage();

  // Lắng nghe console.log từ trang web
  adminPage.on('console', msg => console.log(`[admin-log] ${msg.text()}`));
  workerPage.on('console', msg => console.log(`[worker-log] ${msg.text()}`));

  console.log('\n1. Đăng nhập admin (PIN 1234)...');
  await adminPage.goto('http://localhost:3000/dang-nhap', { waitUntil: 'networkidle' });
  await sleep(500);
  for (const c of '1234') {
    await adminPage.click(`#pin-btn-${c}`);
    await sleep(50);
  }
  await adminPage.click('#btn-login');
  await sleep(1500);

  console.log('2. Đăng nhập worker (PIN 5678)...');
  await workerPage.goto('http://localhost:3000/dang-nhap', { waitUntil: 'networkidle' });
  await sleep(500);
  for (const c of '5678') {
    await workerPage.click(`#pin-btn-${c}`);
    await sleep(50);
  }
  await workerPage.click('#btn-login');
  await sleep(1500);

  console.log('3. Admin tạo đơn mới...');
  await adminPage.goto('http://localhost:3000/tao-don', { waitUntil: 'networkidle' });
  await sleep(1000);

  // Click danh mục đầu tiên
  const catBtns = await adminPage.$$('.cat-card');
  console.log(`   Found ${catBtns.length} categories`);
  if (catBtns.length > 0) {
    await catBtns[0].click();
    await sleep(800);
  }

  // Click product đầu tiên
  const prodBtns = await adminPage.$$('.product-row');
  console.log(`   Found ${prodBtns.length} products`);
  if (prodBtns.length > 0) {
    await prodBtns[0].click();
    await sleep(800);
  }

  // Click size pill đầu tiên
  const pills = await adminPage.$$('.pill-row .pill');
  console.log(`   Found ${pills.length} pills`);
  if (pills.length >= 2) {
    await pills[0].click(); // size
    await sleep(200);
    await pills[1].click(); // color
    await sleep(200);
  }

  // Click Gửi đơn
  const guiDonBtn = await adminPage.$('#btn-gui-don');
  if (guiDonBtn) {
    const isDisabled = await guiDonBtn.isDisabled();
    console.log(`   btn-gui-don disabled: ${isDisabled}`);
    if (!isDisabled) {
      await guiDonBtn.click();
      await sleep(1000);
      console.log('   ✅ Admin tạo đơn thành công!');
    } else {
      console.log('   ❌ btn-gui-don disabled! Không thể tạo đơn');
    }
  } else {
    console.log('   ❌ Không tìm thấy #btn-gui-don');
  }

  // Kiểm tra worker thấy đơn chưa
  console.log('\n4. Kiểm tra worker có thấy đơn mới không...');
  await workerPage.goto('http://localhost:3000/don-hang', { waitUntil: 'networkidle' });
  await sleep(2000);

  const workerBody = await workerPage.textContent('body');
  const hasNoOrders = workerBody.includes('Không có đơn nào');
  const hasPending = workerBody.includes('Chờ may') || workerBody.includes('GẤP');

  if (hasNoOrders) {
    console.log('   ❌ WORKER KHÔNG THẤY ĐƠN!');
    console.log('   Worker page content snippet:', workerBody.substring(0, 300));
  } else if (hasPending) {
    console.log('   ✅ WORKER THẤY ĐƠN! Đồng bộ OK');
  } else {
    console.log('   ⚠️ Không xác định được, kiểm tra thủ công');
    console.log('   Worker body:', workerBody.substring(0, 500));
  }

  // Log pending count
  const match = workerBody.match(/Đang chờ: (\d+)/);
  console.log(`   Worker pending orders: ${match ? match[1] : 'unknown'}`);

  console.log('\n=== TEST COMPLETE ===');
  await browser.close();
}

main().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});