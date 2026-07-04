'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleNum = (n: string) => {
    if (pin.length < 6) setPin(p => p + n);
    setError('');
  };

  const handleDel = () => setPin(p => p.slice(0, -1));

  const handleLogin = () => {
    if (login(pin)) {
      router.replace('/don-hang');
    } else {
      setError('Sai PIN. Thử lại!');
      setPin('');
    }
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
    </div>
  );
}
