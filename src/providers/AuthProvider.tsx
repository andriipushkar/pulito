'use client';

import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { setAccessToken } from '@/lib/api-client';

interface AuthUser {
  id: number;
  email: string;
  role: string;
  fullName: string | null;
  companyName?: string | null;
  wholesaleStatus?: string | null;
  wholesaleGroup?: number | null;
  twoFactorEnabled?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { email: string; password: string; fullName: string; phone?: string; companyName?: string; edrpou?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
});

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshInterval = useRef<ReturnType<typeof setInterval>>(undefined);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refreshAuth = useCallback(async () => {
    // Prevent concurrent refresh calls (React Strict Mode double-mount, race conditions)
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const doRefresh = async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!res.ok) {
          setUser(null);
          setAccessToken(null);
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setAccessToken(data.data.accessToken);
          setUser(data.data.user);
        } else {
          setUser(null);
          setAccessToken(null);
        }
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        refreshInFlight.current = null;
      }
    };

    refreshInFlight.current = doRefresh();
    return refreshInFlight.current;
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setIsLoading(false));

    refreshInterval.current = setInterval(refreshAuth, 13 * 60 * 1000);
    return () => clearInterval(refreshInterval.current);
  }, [refreshAuth]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, error: data.error || 'Помилка входу' };
    } catch {
      return { success: false, error: 'Помилка мережі' };
    }
  }, []);

  const register = useCallback(async (regData: { email: string; password: string; fullName: string; phone?: string; companyName?: string; edrpou?: string }) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(regData),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Помилка реєстрації' };
    } catch {
      return { success: false, error: 'Помилка мережі' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
