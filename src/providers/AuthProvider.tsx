'use client';

import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { setAccessToken, refreshSession } from '@/lib/api-client';

interface AuthUser {
  id: number;
  email: string;
  role: string;
  fullName: string | null;
  phone?: string | null;
  companyName?: string | null;
  wholesaleStatus?: string | null;
  wholesaleGroup?: number | null;
  twoFactorEnabled?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    requiresTwoFactor?: boolean;
    tempToken?: string;
  }>;
  verifyTwoFactor: (
    tempToken: string,
    code: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    companyName?: string;
    edrpou?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  verifyTwoFactor: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshAuth: async () => {},
});

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const lastRefreshAt = useRef<number>(0);

  const refreshAuth = useCallback(async () => {
    // Same-tab dedup so React Strict Mode double-mount + callback page
    // racing the mount-refresh don't fire two fetches. refreshSession()
    // additionally shares an in-flight Promise with api-client's lazy 401
    // retries, so a single /refresh round-trip covers both layers — without
    // this the second concurrent call would race the rotated cookie and trip
    // the server's reuse detector.
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const doRefresh = async () => {
      try {
        const { accessToken: tok, user: u } = await refreshSession();
        if (tok && u) {
          setUser(u as AuthUser);
          lastRefreshAt.current = Date.now();
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

    // No setInterval here. Access tokens expire in 15 min; api-client
    // refreshes lazily on the first 401, which is enough to keep an
    // active session alive. Periodic interval used to fire across every
    // tab and pile up concurrent /auth/refresh calls -> reuse-detector
    // logged everyone out at minute 13.
    //
    // Refresh once when a tab becomes visible again if 10+ min have
    // passed — this keeps long-idle tabs from greeting the user with a
    // 401 on their first click.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefreshAt.current < 10 * 60 * 1000) return;
      refreshAuth();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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
        if (data.data.requiresTwoFactor) {
          return { success: true, requiresTwoFactor: true, tempToken: data.data.tempToken };
        }
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, error: data.error || 'Помилка входу' };
    } catch {
      return { success: false, error: 'Помилка мережі' };
    }
  }, []);

  const verifyTwoFactor = useCallback(async (tempToken: string, code: string) => {
    try {
      const res = await fetch('/api/v1/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ tempToken, code }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data?.user && data.data?.accessToken) {
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, error: data.error || 'Невірний код' };
    } catch {
      return { success: false, error: 'Помилка мережі' };
    }
  }, []);

  const register = useCallback(
    async (regData: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      companyName?: string;
      edrpou?: string;
    }) => {
      try {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify(regData),
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success && data.data) {
          // Auto-login after registration
          setAccessToken(data.data.accessToken);
          if (data.data.user) {
            setUser(data.data.user);
          }
          return { success: true };
        }
        return { success: false, error: data.error || 'Помилка реєстрації' };
      } catch {
        return { success: false, error: 'Помилка мережі' };
      }
    },
    [],
  );

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
    <AuthContext.Provider
      value={{ user, isLoading, login, verifyTwoFactor, register, logout, refreshAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}
