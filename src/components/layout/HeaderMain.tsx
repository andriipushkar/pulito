'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import SearchBar from './SearchBar';
import IconButton from '@/components/ui/IconButton';
import MiniCart from './MiniCart';
import MobileMenu from './MobileMenu';
import { Heart, Cart, User, Menu, Bell } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import type { CategoryListItem } from '@/types/category';

interface HeaderMainProps {
  categories: CategoryListItem[];
}

export default function HeaderMain({ categories }: HeaderMainProps) {
  const { user } = useAuth();
  const { itemCount, total } = useCart();
  const { wishlistCount } = useWishlist();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotificationCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient.get<{ count: number }>('/api/v1/me/notifications/count');
      if (res.success && res.data) setUnreadCount(res.data.count);
    } catch {
      // silently fail
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(fetchNotificationCount, 60000);
    // Use Promise.resolve to avoid synchronous setState in effect
    Promise.resolve().then(fetchNotificationCount);
    return () => clearInterval(interval);
  }, [fetchNotificationCount]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-[var(--radius)] focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-white"
      >
        Перейти до основного вмісту
      </a>
      <div className="border-b border-[var(--color-border)]">
        <Container className="flex items-center gap-4 py-3">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] transition-colors hover:bg-[var(--color-bg-secondary)] lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Меню"
          >
            <Menu size={26} />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2 text-xl font-bold text-[var(--color-text)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-sm font-black text-white shadow-[var(--shadow-brand)]">C</span>
            <span>Clean<span className="text-[var(--color-primary)]">Shop</span></span>
          </Link>

          <div className="hidden flex-1 lg:block">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {user && (
              <Link href="/account/notifications" className="hidden sm:block">
                <IconButton icon={<Bell size={20} />} badge={unreadCount} label="Сповіщення" />
              </Link>
            )}

            <Link href="/wishlist" className="hidden sm:block">
              <IconButton icon={<Heart size={20} />} badge={wishlistCount} label="Обране" />
            </Link>

            <div className="relative flex items-center gap-1">
              <IconButton
                icon={<Cart size={20} />}
                badge={itemCount}
                label="Кошик"
                onClick={() => setCartOpen(!cartOpen)}
              />
              {itemCount > 0 && (
                <span className="hidden text-sm font-medium text-[var(--color-text)] sm:inline-block">
                  {formatPrice(total(user?.role))}
                </span>
              )}
              {cartOpen && <MiniCart onClose={() => setCartOpen(false)} />}
            </div>

            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {itemCount > 0 ? `У кошику ${itemCount} товарів` : 'Кошик порожній'}
            </span>

            <Link href={user ? '/account' : '/auth/login'} className="flex items-center gap-1.5">
              <IconButton icon={<User size={20} />} label={user ? 'Профіль' : 'Увійти'} />
              {user?.role === 'wholesaler' && (
                <span className="hidden rounded-full bg-gradient-to-r from-[var(--color-gold-dark)] to-[var(--color-gold)] px-2 py-0.5 text-[10px] font-semibold text-white shadow-[var(--shadow-gold)] sm:inline-block">
                  Оптовий клієнт
                </span>
              )}
            </Link>
          </div>
        </Container>

        <div className="bg-[var(--color-bg-secondary)] px-4 py-2.5 lg:hidden">
          <SearchBar />
        </div>
      </div>

      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
      />
    </>
  );
}
