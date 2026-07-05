'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { shouldAskPushPermission, dismissPushAsk, requestPushPermission, ensurePushSubscription } from '@/lib/pushNotifications';

// Lấy user id từ phiên vừa lưu (login() ghi vào localStorage trước khi trả về)
function getSessionUserId(): string {
  try {
    return JSON.parse(localStorage.getItem('xuong81_session') || '{}').id || '';
  } catch {
    return '';
  }
}

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [askPush, setAskPush] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleNum = (n: string) => {
    if (pin.length < 6) setPin(p => p + n);
    setError('');
  };

  const handleDel = () => setPin(p => p.slice(0, -1));

  const handleLogin = async () => {
    if (await login(pin)) {
      if (shouldAskPushPermission()) {
        // Chưa hỏi lần nào -> hiện hộp thoại giải thích trước khi gọi permission prompt
        setAskPush(true);
        return;
      }
      // Đã cho phép từ trước -> âm thầm đảm bảo subscription còn hiệu lực
      ensurePushSubscription(getSessionUserId());
      router.replace('/don-hang');
    } else {
      setError('Sai PIN. Thử lại!');
      setPin('');
    }
  };

  const acceptPush = async () => {
    setAskPush(false);
    await requestPushPermission(getSessionUserId());
    router.replace('/don-hang');
  };

  const declinePush = () => {
    dismissPushAsk();
    setAskPush(false);
    router.replace('/don-hang');
  };

  const dots = Array(6).fill('').map((_, i) => pin.length > i ? '●' : '○').join(' ');

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">🏭</div>
        <div className="login-title">Xưởng 81 Hồ Văn Huê</div>
        <div className="login-sub">Nhập mã PIN để đăng nhập</div>

        <div className="pin-display">{dots}</div>

        {error && <div className="login-error">{error}</div>}

        <div className="numpad">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button
              key={i}
              className="numpad-btn"
              id={`pin-btn-${k || 'empty'}`}
              onClick={() => {
                if (k === '⌫') handleDel();
                else if (k !== '') handleNum(k);
              }}
              style={{ visibility: k === '' ? 'hidden' : 'visible' }}
            >
              {k}
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary btn-full btn-lg"
          id="btn-login"
          onClick={handleLogin}
          disabled={pin.length === 0}
          style={{ opacity: pin.length === 0 ? .5 : 1 }}
        >
          Đăng nhập
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 16 }}>
          Demo: Admin PIN 1234 · Công nhân PIN 5678
        </p>
      </div>

      {askPush && (
        <div className="modal-overlay">
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔔 Thông báo đơn hàng</div>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>
              Cho phép nhận thông báo khi có đơn hàng mới?
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
              Thông báo hiện trên màn hình điện thoại kể cả khi không mở app (cần có mạng).
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" id="btn-push-later" onClick={declinePush}>Để sau</button>
              <button className="btn btn-primary" id="btn-push-allow" onClick={acceptPush}>Đồng ý</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
