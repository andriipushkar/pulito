'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import SearchBar from './SearchBar';
import IconButton from '@/components/ui/IconButton';
import MiniCart from './MiniCart';
import { Heart, Cart, User, Bell, Compare } from '@/components/icons';
import CallbackButton from '@/components/common/CallbackButton';
import ChatWidget from '@/components/common/ChatWidget';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useComparison } from '@/hooks/useComparison';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import type { CategoryListItem } from '@/types/category';

interface HeaderMainProps {
  categories: CategoryListItem[];
  shrink?: boolean;
}

export default function HeaderMain({ categories, shrink }: HeaderMainProps) {
  const { user } = useAuth();
  const { itemCount, total } = useCart();
  const { wishlistCount } = useWishlist();
  const { count: comparisonCount } = useComparison();
  const [cartOpen, setCartOpen] = useState(false);
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
        <Container className={`flex items-center gap-4 transition-all duration-300 ${shrink ? 'py-1.5' : 'py-3'}`}>
          <Link href="/" className="flex shrink-0 items-center gap-1.5 text-xl font-bold tracking-tight text-[var(--color-text)] sm:gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-sm font-extrabold text-white shadow-[var(--shadow-brand)]">П</span>
            <span>Поро<span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] bg-clip-text text-transparent">шок</span></span>
          </Link>

          <div className="hidden flex-1 lg:block">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Mobile: notification bell + phone link */}
            {user && (
              <Link
                href="/account/notifications"
                className="relative inline-flex items-center justify-center rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] lg:hidden"
                aria-label="Сповіщення"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <a
              href="tel:+380001234567"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20 lg:hidden"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              Зателефонувати
            </a>
            <CallbackButton
              triggerClassName="relative hidden lg:inline-flex items-center justify-center rounded-[var(--radius)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-secondary)] h-10 w-10"
              iconSize={20}
            />

            {/* Desktop only: chat, notifications, wishlist, cart, profile */}
            <div className="relative hidden lg:block">
              <ChatWidget
                triggerClassName="relative inline-flex items-center justify-center rounded-[var(--radius)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-secondary)] h-10 w-10"
                iconSize={20}
              />
            </div>

            {user && (
              <Link href="/account/notifications" className="hidden lg:block">
                <IconButton icon={<Bell size={20} />} badge={unreadCount} label="Сповіщення" />
              </Link>
            )}

            <Link href="/comparison" className="hidden lg:block">
              <IconButton icon={<Compare size={20} />} badge={comparisonCount} label="Порівняння" />
            </Link>

            <Link href="/account/wishlist" className="hidden lg:block">
              <IconButton icon={<Heart size={20} />} badge={wishlistCount} label="Обране" />
            </Link>

            <div
              className="relative hidden items-center gap-1 lg:flex"
              onMouseEnter={() => { if (itemCount > 0) setCartOpen(true); }}
              onMouseLeave={() => setCartOpen(false)}
            >
              <IconButton
                icon={<Cart size={20} />}
                badge={itemCount}
                label="Кошик"
                onClick={() => setCartOpen(!cartOpen)}
              />
              {itemCount > 0 && (
                <span className="hidden text-sm font-medium text-[var(--color-text)] lg:inline-block">
                  {formatPrice(total(user?.role))}
                </span>
              )}
              {cartOpen && <MiniCart onClose={() => setCartOpen(false)} />}
            </div>

            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {itemCount > 0 ? `У кошику ${itemCount} товарів` : 'Кошик порожній'}
            </span>

            <Link href={user ? '/account' : '/auth/login'} className="hidden items-center gap-1.5 lg:flex">
              <IconButton icon={<User size={20} />} label={user ? 'Профіль' : 'Увійти'} />
              {user?.role === 'wholesaler' && (
                <span className="hidden rounded-full bg-gradient-to-r from-[var(--color-gold-dark)] to-[var(--color-gold)] px-2 py-0.5 text-[10px] font-semibold text-white shadow-[var(--shadow-gold)] lg:inline-block">
                  Оптовий клієнт
                </span>
              )}
            </Link>
          </div>
        </Container>

        <div className="px-4 py-2.5 lg:hidden">
          <SearchBar />
        </div>
      </div>

    </>
  );
}
