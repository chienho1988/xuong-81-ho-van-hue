'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/mockData';
import { getUserByPin } from '@/lib/supabaseService';

interface AuthContextType {
  user: User | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Phục hồi phiên từ localStorage (chỉ lưu id, không lưu pin)
    const saved = localStorage.getItem('xuong81_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Có thể fetch user từ Supabase nếu muốn
        if (parsed.id) {
          setUser(parsed as User);
        }
      } catch {}
    }
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    const found = await getUserByPin(pin);
    if (found) {
      setUser(found);
      localStorage.setItem('xuong81_session', JSON.stringify({ id: found.id, name: found.name, role: found.role }));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('xuong81_session');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}