'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

interface WishlistBulkValue {
  /** True when the value comes from server data (authenticated) and is loaded. */
  loaded: boolean;
  isWished: (productId: number) => boolean;
  setWished: (productId: number, value: boolean) => void;
}

const noopContext: WishlistBulkValue = {
  loaded: false,
  isWished: () => false,
  setWished: () => {},
};

const WishlistBulkContext = createContext<WishlistBulkValue | null>(null);

export function useWishlistBulk(): WishlistBulkValue | null {
  return useContext(WishlistBulkContext);
}

/**
 * Bulk-loads wishlist status for a list of productIds once per page, so each
 * ProductCard doesn't have to issue its own HEAD request. Falls back to the
 * per-card behavior when no productIds are provided (the noop context).
 */
export function WishlistBulkProvider({
  productIds,
  children,
}: {
  productIds: number[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [wished, setWishedState] = useState<Set<number>>(() => new Set());
  const [loaded, setLoaded] = useState(false);

  const idsKey = useMemo(() => [...productIds].sort((a, b) => a - b).join(','), [productIds]);

  useEffect(() => {
    if (!user) {
      setLoaded(false);
      return;
    }
    if (productIds.length === 0) {
      setWishedState(new Set());
      setLoaded(true);
      return;
    }
    const controller = new AbortController();
    apiClient
      .get<{ wishlisted: number[] }>(
        `/api/v1/me/wishlists/default/items/bulk?ids=${idsKey}`,
        { signal: controller.signal },
      )
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.success && res.data?.wishlisted) {
          setWishedState(new Set(res.data.wishlisted));
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, [user, idsKey, productIds.length]);

  const value: WishlistBulkValue = useMemo(
    () =>
      user
        ? {
            loaded,
            isWished: (id) => wished.has(id),
            setWished: (id, value) => {
              setWishedState((prev) => {
                const next = new Set(prev);
                if (value) next.add(id);
                else next.delete(id);
                return next;
              });
            },
          }
        : noopContext,
    [loaded, wished, user],
  );

  return <WishlistBulkContext.Provider value={value}>{children}</WishlistBulkContext.Provider>;
}
