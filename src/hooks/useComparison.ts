'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'clean-shop-comparison';
const MAX_ITEMS = 4;

function getStoredIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function setStoredIds(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_ITEMS)));
  } catch {}
}

export function useComparison() {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    setIds(getStoredIds());
  }, []);

  const add = useCallback((productId: number) => {
    setIds((prev) => {
      if (prev.includes(productId) || prev.length >= MAX_ITEMS) return prev;
      const next = [...prev, productId];
      setStoredIds(next);
      return next;
    });
  }, []);

  const remove = useCallback((productId: number) => {
    setIds((prev) => {
      const next = prev.filter((id) => id !== productId);
      setStoredIds(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    setStoredIds([]);
  }, []);

  const has = useCallback((productId: number) => ids.includes(productId), [ids]);

  const toggle = useCallback((productId: number) => {
    if (ids.includes(productId)) {
      remove(productId);
    } else {
      add(productId);
    }
  }, [ids, add, remove]);

  return { ids, count: ids.length, add, remove, clear, has, toggle, isFull: ids.length >= MAX_ITEMS };
}
