/**
 * Web Push phía client: đăng ký service worker, xin quyền,
 * lưu subscription vào bảng push_subscriptions (1 dòng / user).
 */
import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = 'xuong81_push_dismissed';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  );
}

// Có nên hiện hộp thoại xin quyền không (chưa hỏi lần nào + chưa bấm "Để sau")
export function shouldAskPushPermission(): boolean {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'default') return false;
  try {
    if (localStorage.getItem(DISMISS_KEY)) return false;
  } catch {}
  return true;
}

export function dismissPushAsk() {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return buffer;
}

/**
 * Đã có quyền -> đảm bảo subscription tồn tại và được lưu vào Supabase.
 * An toàn khi bảng push_subscriptions chưa được migrate (chỉ warn, không throw).
 */
export async function ensurePushSubscription(userId: string): Promise<boolean> {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted' || !userId) return false;
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
    }
    // 1 dòng / user (id = user_id) -> đăng nhập lại là update, không tạo trùng
    const { error } = await supabase.from('push_subscriptions').upsert({
      id: userId,
      user_id: userId,
      subscription: sub.toJSON(),
    });
    if (error) {
      console.warn('[Push] Chưa lưu được subscription (đã chạy supabase-add-push-subscriptions.sql chưa?):', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Push] Không đăng ký được push:', e);
    return false;
  }
}

/** Gọi SAU KHI user bấm "Đồng ý" trên hộp thoại tiếng Việt của app. */
export async function requestPushPermission(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  return ensurePushSubscription(userId);
}

// Trạng thái thông báo để hiện đúng nút/hướng dẫn trong app
export type PushState =
  | 'unsupported'   // trình duyệt không hỗ trợ (vd Safari iOS chưa cài PWA)
  | 'off'           // chưa bật (permission 'default', hoặc đã cho phép nhưng chưa có subscription)
  | 'denied'        // đã bị chặn ở trình duyệt — không thể hỏi lại, phải mở cài đặt
  | 'enabled';      // đã bật và đã có subscription

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'off';
  // permission === 'granted' -> kiểm tra đã có subscription chưa
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? 'enabled' : 'off';
  } catch {
    return 'off';
  }
}

/**
 * Bật thông báo theo yêu cầu rõ ràng của user (bấm nút "Bật").
 * Xử lý mọi trạng thái quyền, trả về trạng thái cuối cùng.
 * Bỏ qua cờ "Để sau" vì đây là hành động chủ động của user.
 */
export async function enablePush(userId: string): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm === 'denied') return 'denied';
    if (perm !== 'granted') return 'off';
  }
  // Đã cho phép -> đăng ký + lưu subscription
  try { localStorage.removeItem(DISMISS_KEY); } catch {}
  const ok = await ensurePushSubscription(userId);
  return ok ? 'enabled' : 'off';
}
