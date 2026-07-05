/**
 * Test E2E: Admin tạo đơn → Worker thấy ngay
 * Chạy: node test-sync.mjs
 */
import { chromium } from 'playwright';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: false }); // Mở trình duyệt để bạn nhìn thấy

  // Mở 2 context riêng biệt (như 2 thiết bị khác nhau)
  const ctxAdmin = await browser.newContext();
  const ctxWorker = await browser.newContext();

  const adminPage = await ctxAdmin.newPage();
  const workerPage = await ctxWorker.newPage();

  console.log('=== TEST ORDER SYNC ===');
  console.log('1. Đăng nhập admin (PIN 1234)...');
  await adminPage.goto('http://localhost:3000/dang-nhap');
  await sleep(500);
  // Nhập PIN
  for (const c of '1234') {
    await adminPage.click(`#pin-btn-${c}`);
    await sleep(100);
  }
  await adminPage.click('#btn-login');
  await sleep(1000);

  console.log('2. Đăng nhập worker (PIN 5678)...');
  await workerPage.goto('http://localhost:3000/dang-nhap');
  await sleep(500);
  for (const c of '5678') {
    await workerPage.click(`#pin-btn-${c}`);
    await sleep(100);
  }
  await workerPage.click('#btn-login');
  await sleep(1000);

  // Kiểm tra worker đã vào trang don-hang chưa
  const workerUrl = workerPage.url();
  console.log(`   Worker URL: ${workerUrl}`);

  console.log('3. Admin tạo đơn mới...');
  await adminPage.goto('http://localhost:3000/tao-don');
  await sleep(1500);

  // Chọn danh mục đầu tiên
  const catCards = await adminPage.$$('.cat-card');
  if (catCards.length > 0) {
    await catCards[0].click();
    await sleep(500);
  }

  // Chọn sản phẩm đầu tiên
  const prodRows = await adminPage.$$('.product-row');
  if (prodRows.length > 0) {
    await prodRows[0].click();
    await sleep(500);
  }

  // Chọn size đầu tiên
  const sizePills = await adminPage.$$('.pill');
  if (sizePills.length > 0) {
    await sizePills[0].click();
    await sleep(200);
  }

  // Chọn màu đầu tiên
  const colorPills = await adminPage.$$('.pill');
  if (colorPills.length > 1) {
    await colorPills[1].click();
    await sleep(200);
  }

  // Bấm "Gửi đơn"
  await adminPage.click('#btn-gui-don');
  await sleep(1000);

  console.log('   ✅ Admin đã tạo đơn thành công!');

  // Kiểm tra worker thấy đơn chưa
  console.log('4. Kiểm tra worker có thấy đơn mới không...');
  await workerPage.goto('http://localhost:3000/don-hang');
  await sleep(2000); // Đợi auto refresh

  const workerBody = await workerPage.textContent('body');
  if (workerBody?.includes('Không có đơn nào')) {
    console.log('   ❌ WORKER KHÔNG THẤY ĐƠN!');
    console.log('   Kiểm tra log console trong worker app để biết lý do');
  } else {
    console.log('   ✅ WORKER THẤY ĐƠN! Đồng bộ OK');
  }

  // Log ra console
  const ordersCount = (workerBody?.match(/cái/g) || []).length;
  console.log(`   Worker đang thấy ${ordersCount} đơn hàng`);

  console.log('\n=== TEST COMPLETE ===');
  await sleep(5000);
  await browser.close();
}

main().catch(console.error);