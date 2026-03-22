'use client';

import { createContext, useCallback, useEffect, useOptimistic, useReducer, useTransition, type ReactNode } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { fetcher } from '@/lib/swr';

export interface CartItem {
  productId: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: number;
  priceWholesale: number | null;
  imagePath: string | null;
  quantity: number;
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'SET_ITEMS'; items: CartItem[] }
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; productId: number }
  | { type: 'UPDATE_QUANTITY'; productId: number; quantity: number }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.items };
    case 'ADD_ITEM': {
      const existing = state.items.find((i) => i.productId === action.item.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === action.item.productId
              ? { ...i, quantity: Math.min(i.quantity + action.item.quantity, i.maxQuantity) }
              : i
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter((i) => i.productId !== action.productId) };
    case 'UPDATE_QUANTITY':
      return {
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: Math.max(1, Math.min(action.quantity, i.maxQuantity)) }
            : i
        ),
      };
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

const STORAGE_KEY = 'clean-shop-cart';
const CART_API_KEY = '/api/v1/cart';

interface CartContextValue {
  items: CartItem[];
  /** Optimistic item count — updates instantly before server confirms */
  itemCount: number;
  total: (role?: string) => number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  /** True while a server action is in flight */
  isPending: boolean;
}

export const CartContext = createContext<CartContextValue>({
  items: [],
  itemCount: 0,
  total: () => 0,
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  isPending: false,
});

export default function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [isPending, startTransition] = useTransition();

  // SWR for authenticated users — fetch cart from server
  const { data: serverCart } = useSWR<CartItem[]>(
    user ? CART_API_KEY : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  // Sync server cart data into local state when it arrives
  useEffect(() => {
    if (serverCart && Array.isArray(serverCart)) {
      dispatch({ type: 'SET_ITEMS', items: serverCart });
    }
  }, [serverCart]);

  // Optimistic count: user sees the updated number immediately
  const [optimisticItemCount, setOptimisticItemCount] = useOptimistic(
    state.items.reduce((sum, i) => sum + i.quantity, 0)
  );

  // Load from localStorage for anonymous users
  useEffect(() => {
    if (!user) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          dispatch({ type: 'SET_ITEMS', items: JSON.parse(saved) });
        }
      } catch {}
    }
  }, [user]);

  // Persist to localStorage for anonymous users
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      } catch {}
    }
  }, [state.items, user]);

  const addItem = useCallback((item: CartItem) => {
    startTransition(() => {
      setOptimisticItemCount((prev) => prev + item.quantity);
      dispatch({ type: 'ADD_ITEM', item });
    });
    if (user) {
      // Optimistically update SWR cache, then revalidate
      globalMutate(CART_API_KEY);
    }
  }, [setOptimisticItemCount, user]);

  const removeItem = useCallback((productId: number) => {
    startTransition(() => {
      dispatch({ type: 'REMOVE_ITEM', productId });
    });
    if (user) {
      globalMutate(CART_API_KEY);
    }
  }, [user]);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', productId, quantity });
    if (user) {
      globalMutate(CART_API_KEY);
    }
  }, [user]);

  const clearCart = useCallback(() => {
    startTransition(() => {
      setOptimisticItemCount(0);
      dispatch({ type: 'CLEAR' });
    });
    if (user) {
      globalMutate(CART_API_KEY);
    }
  }, [setOptimisticItemCount, user]);

  const total = useCallback(
    (role?: string) =>
      state.items.reduce((sum, item) => {
        const price =
          role === 'wholesaler' && item.priceWholesale ? item.priceWholesale : item.priceRetail;
        return sum + price * item.quantity;
      }, 0),
    [state.items]
  );

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        itemCount: optimisticItemCount,
        total,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isPending,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
