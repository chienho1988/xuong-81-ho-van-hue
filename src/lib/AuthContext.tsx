'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, MOCK_USERS } from '@/lib/mockData';

interface AuthContextType {
  user: User | null;
  login: (pin: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Phục hồi phiên từ localStorage
    const saved = localStorage.getItem('xuong81_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const found = MOCK_USERS.find(u => u.id === parsed.id);
        if (found) setUser(found);
      } catch {}
    }
  }, []);

  const login = (pin: string): boolean => {
    const found = MOCK_USERS.find(u => u.pin === pin.trim());
    if (found) {
      setUser(found);
      localStorage.setItem('xuong81_session', JSON.stringify({ id: found.id }));
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
