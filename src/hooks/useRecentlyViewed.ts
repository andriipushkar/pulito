'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { apiClient } from '@/lib/api-client';

const STORAGE_KEY = 'clean-shop-recently-viewed';
const MAX_ITEMS = 15;

export function useRecentlyViewed() {
  const { user } = useAuth();
  const [ids, setIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const hasMergedRef = useRef(false);

  // Merge localStorage data with server when user logs in
  useEffect(() => {
    if (!user || hasMergedRef.current) return;
    hasMergedRef.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const localIds: number[] = JSON.parse(saved);
      if (localIds.length === 0) return;

      apiClient
        .post('/api/v1/me/recently-viewed/merge', { productIds: localIds })
        .then(() => {
          localStorage.removeItem(STORAGE_KEY);
        })
        .catch(() => {});
    } catch {}
  }, [user]);

  const addItem = useCallback(
    (productId: number) => {
      setIds((prev) => {
        const filtered = prev.filter((id) => id !== productId);
        const next = [productId, ...filtered].slice(0, MAX_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      if (user) {
        apiClient.post('/api/v1/me/recently-viewed', { productId }).catch(() => {});
      }
    },
    [user]
  );

  const getItems = useCallback(() => ids, [ids]);

  return { ids, addItem, getItems };
}
