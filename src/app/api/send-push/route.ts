/**
 * POST /api/send-push
 * Body: { role: 'admin' | 'worker', title: string, body?: string }
 * Gửi Web Push tới mọi subscription của user có role tương ứng.
 * Subscription hết hạn (404/410) sẽ bị xoá khỏi push_subscriptions.
 */
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function restHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function POST(req: Request) {
  try {
    const { role, title, body } = await req.json();
    if ((role !== 'admin' && role !== 'worker') || !title) {
      return Response.json({ ok: false, error: 'Cần role (admin/worker) và title' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      return Response.json({ ok: false, error: 'Chưa cấu hình VAPID keys' }, { status: 500 });
    }
    webpush.setVapidDetails('mailto:thaonguyenthu79@gmail.com', publicKey, privateKey);

    // Lấy user theo role đích
    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.${role}&select=id`,
      { headers: restHeaders(), cache: 'no-store' }
    );
    const users: { id: string }[] = await usersRes.json();
    if (!Array.isArray(users) || users.length === 0) {
      return Response.json({ ok: true, sent: 0 });
    }

    // Lấy subscription của các user đó
    const idList = users.map(u => `"${u.id}"`).join(',');
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${idList})&select=id,subscription`,
      { headers: restHeaders(), cache: 'no-store' }
    );
    if (!subsRes.ok) {
      // Bảng chưa được migrate — không phải lỗi nghiêm trọng, chỉ chưa gửi được
      return Response.json({ ok: false, error: 'Bảng push_subscriptions chưa có (chạy supabase-add-push-subscriptions.sql)' }, { status: 500 });
    }
    const subs: { id: string; subscription: unknown }[] = await subsRes.json();

    const payload = JSON.stringify({
      title,
      body: body || '',
      icon: '/icon-192.png',
      url: '/don-hang',
    });

    let sent = 0;
    await Promise.all(subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Subscription hết hạn -> xoá
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${row.id}`, {
            method: 'DELETE',
            headers: restHeaders(),
          }).catch(() => {});
        }
      }
    }));

    return Response.json({ ok: true, sent, total: subs.length });
  } catch (e) {
    console.error('[send-push]', e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
