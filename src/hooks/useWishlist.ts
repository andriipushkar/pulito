'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { fetcher } from '@/lib/swr';

const LOCAL_STORAGE_KEY = 'clean-shop-wishlist';

function getLocalWishlistCount(): number {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    return 0;
  } catch {
    return 0;
  }
}

export function useWishlist() {
  const { user } = useAuth();
  const [localCount, setLocalCount] = useState(0);

  // SWR for authenticated users
  const { data } = useSWR<{ count: number }>(
    user ? '/api/v1/me/wishlists/count' : null,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true, dedupingInterval: 10000 }
  );

  // Sync local count for anonymous users
  useEffect(() => {
    if (!user) {
      setLocalCount(getLocalWishlistCount());
    }
  }, [user]);

  // Listen for storage changes (e.g. from another tab or wishlist toggle)
  const refreshLocal = useCallback(() => {
    if (!user) {
      setLocalCount(getLocalWishlistCount());
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      const interval = setInterval(refreshLocal, 60000);
      return () => clearInterval(interval);
    }
  }, [user, refreshLocal]);

  const wishlistCount = user ? (data?.count ?? 0) : localCount;

  return { wishlistCount };
}
