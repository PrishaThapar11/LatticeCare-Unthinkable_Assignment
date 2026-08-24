import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export type AuthUser = { id: string; email: string; firstName: string; role: Role };

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { email: string; password: string; firstName: string; lastName: string }) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('lc_user');
    if (raw) setUser(JSON.parse(raw));
    setLoading(false);
  }, []);

  const persist = (token: string, u: AuthUser) => {
    localStorage.setItem('lc_token', token);
    localStorage.setItem('lc_user', JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    persist(data.token, data.user);
    return data.user as AuthUser;
  };

  const register = async (input: { email: string; password: string; firstName: string; lastName: string }) => {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(input) });
    persist(data.token, data.user);
    return data.user as AuthUser;
  };

  const logout = () => {
    localStorage.removeItem('lc_token');
    localStorage.removeItem('lc_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
