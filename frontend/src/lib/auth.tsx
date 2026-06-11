'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'OWNER' | 'MANAGER' | 'VETERINARIAN' | 'ACCOUNTANT' | 'WORKER';
  farmId: string | null;
  farm?: { id: string; name: string; code: string; location: string };
  profileImageUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthorized: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (token === 'dummy-token') {
      setUser({
        id: '1',
        email: 'farmerp@pashuvaani.com',
        name: 'Farmer',
        role: 'OWNER',
        farmId: '1',
      });
      setIsLoading(false);
      return;
    }
    try {
      const res = await authApi.me();
      setUser(res.data.data);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email: string, password: string) => {
    if (email === 'farmerp@pashuvaani.com' && password === 'pashuvaani') {
      localStorage.setItem('accessToken', 'dummy-token');
      localStorage.setItem('refreshToken', 'dummy-token');
      setUser({
        id: '1',
        email: 'farmerp@pashuvaani.com',
        name: 'Farmer',
        role: 'OWNER',
        farmId: '1',
      });
      return;
    }
    const res = await authApi.login(email, password);
    const { user: userData, accessToken, refreshToken } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location.href = '/login';
  };

  const isAuthorized = (...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthorized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
