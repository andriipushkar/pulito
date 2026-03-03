'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

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
  const [wishlistCount, setWishlistCount] = useState(0);

  const fetchWishlistCount = useCallback(async () => {
    if (user) {
      try {
        const res = await apiClient.get<{ count: number }>('/api/v1/me/wishlists/count');
        if (res.success && res.data) {
          setWishlistCount(res.data.count);
        }
      } catch {
        // silently fail
      }
    } else {
      setWishlistCount(getLocalWishlistCount());
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(fetchWishlistCount, 60000);
    Promise.resolve().then(fetchWishlistCount);
    return () => clearInterval(interval);
  }, [fetchWishlistCount]);

  return { wishlistCount };
}
