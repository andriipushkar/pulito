'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Cart, User } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import MobileMenu from './MobileMenu';
import type { CategoryListItem } from '@/types/category';

interface MobileBottomNavProps {
  categories: CategoryListItem[];
}

const IconHome = () => (
  <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const IconGrid = () => (
  <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

export default function MobileBottomNav({ categories }: MobileBottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { user } = useAuth();
  const lastScrollY = useRef(0);

  const isActive = (path: string) => pathname === path;

  // Fetch notification count
  const fetchNotificationCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient.get<{ count: number }>('/api/v1/me/notifications/count');
      if (res.success && res.data) setUnreadCount(res.data.count);
    } catch { /* silently fail */ }
  }, [user]);

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 60000);
    return () => clearInterval(interval);
  }, [fetchNotificationCount]);

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 100) {
        setVisible(true);
      } else if (currentY > lastScrollY.current + 10) {
        setVisible(false);
      } else if (currentY < lastScrollY.current - 10) {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItemBase = "flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-semibold transition-all duration-200";
  const activeClass = "text-[var(--color-primary)]";
  const inactiveClass = "text-[var(--color-text-secondary)]";

  return (
    <>
      {/* Spacer removed — footer handles bottom padding for mobile nav */}

      {/* Floating bottom bar */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 px-3 transition-transform duration-300 lg:hidden ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div className="glass-nav mx-auto flex h-[60px] max-w-md items-center justify-around rounded-2xl border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
          {/* Home */}
          <Link
            href="/"
            className={`${navItemBase} ${isActive('/') ? activeClass : inactiveClass}`}
          >
            <IconHome />
            <span>Головна</span>
          </Link>

          {/* Catalog */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`${navItemBase} ${pathname?.startsWith('/catalog') ? activeClass : inactiveClass}`}
          >
            <IconGrid />
            <span>Каталог</span>
          </button>

          {/* Cart — center accent */}
          <Link
            href="/cart"
            className="relative -mt-4 flex flex-col items-center gap-0.5"
          >
            <div className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-[var(--shadow-brand)] transition-transform duration-200 active:scale-95 ${itemCount > 0 ? 'animate-cart-pulse' : ''}`}>
              <Cart size={22} />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-bold text-white ring-2 ring-white shadow-sm">
                  {itemCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-semibold ${isActive('/cart') ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>Кошик</span>
          </Link>

          {/* Profile */}
          <Link
            href="/account"
            className={`${navItemBase} ${pathname?.startsWith('/account') && pathname !== '/account/wishlist' ? activeClass : inactiveClass}`}
          >
            <div className="relative">
              <User size={22} />
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span>Профіль</span>
          </Link>
        </div>
      </nav>

      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
      />
    </>
  );
}
