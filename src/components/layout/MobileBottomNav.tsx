'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Cart, User } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import MobileMenu from './MobileMenu';
import type { CategoryListItem } from '@/types/category';

interface MobileBottomNavProps {
  categories: CategoryListItem[];
}

const IconHome = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const IconGrid = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

export default function MobileBottomNav({ categories }: MobileBottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Spacer so content doesn't hide behind fixed nav */}
      <div className="h-16 lg:hidden" />

      {/* Fixed bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)]/60 bg-[var(--color-bg)]/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {/* Home */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
              isActive('/') ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            <IconHome />
            <span>Головна</span>
          </Link>

          {/* Catalog — opens Bottom Sheet */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
              pathname?.startsWith('/catalog') ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            <IconGrid />
            <span>Каталог</span>
          </button>

          {/* Cart */}
          <Link
            href="/cart"
            className="relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors"
          >
            <div className="relative">
              <Cart size={24} />
              {itemCount > 0 && (
                <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[9px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </div>
            <span>Кошик</span>
          </Link>

          {/* Wishlist */}
          <Link
            href="/account/wishlist"
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
              pathname === '/account/wishlist' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            <div className="relative">
              <Heart size={24} />
              {wishlistCount > 0 && (
                <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[9px] font-bold text-white">
                  {wishlistCount}
                </span>
              )}
            </div>
            <span>Обране</span>
          </Link>

          {/* Profile */}
          <Link
            href="/account"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
              pathname?.startsWith('/account') && pathname !== '/account/wishlist' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            <User size={24} />
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
