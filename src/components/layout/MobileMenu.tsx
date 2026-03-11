'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Close, Telegram, Viber, Instagram, Facebook, TikTok, Heart, User, ChevronRight, Phone, MessageCircle, HelpCircle } from '@/components/icons';
import type { CategoryListItem } from '@/types/category';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryListItem[];
}

export default function MobileMenu({ isOpen, onClose, categories }: MobileMenuProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  /* Lock body scroll & focus close button */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parents = categories.filter((c) => !c.parentId && c.isVisible);

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню навігації">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl bg-[var(--color-bg)] shadow-2xl animate-slide-up-sheet"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Handle bar + header */}
        <div className="shrink-0 px-5 pb-2 pt-3">
          {/* Drag handle */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border)]" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--color-text)]">Каталог</h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]"
              aria-label="Закрити"
            >
              <Close size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <nav
          role="navigation"
          aria-label="Мобільна навігація"
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom,16px)]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Promo banner */}
          <Link
            href="/catalog?promo=true"
            className="mb-2 flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-white shadow-sm"
            onClick={onClose}
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c.5 2.5 3 5 5 7-1 4-3 7-5 9-2-2-4-5-5-9 2-2 4.5-4.5 5-7z" />
            </svg>
            <span className="text-[15px] font-semibold">Акції та знижки</span>
            <ChevronRight size={16} className="ml-auto opacity-70" />
          </Link>

          {/* All catalog */}
          <Link
            href="/catalog"
            className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-[15px] font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/5"
            onClick={onClose}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Весь каталог
            <ChevronRight size={16} className="ml-auto text-[var(--color-primary)] opacity-50" />
          </Link>

          {/* Divider */}
          <div className="my-1 border-t border-[var(--color-border)]/60" />

          {/* Categories */}
          <div>
            {parents.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="flex min-h-[48px] items-center justify-between rounded-xl px-4 text-[15px] font-medium text-[var(--color-text)] transition-colors active:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/60"
                onClick={onClose}
              >
                <span>{cat.name}</span>
                <ChevronRight size={16} className="shrink-0 text-[var(--color-text-secondary)] opacity-40" />
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[var(--color-border)]/60" />

          {/* Account links */}
          <div>
            <Link
              href="/account/wishlist"
              className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-[15px] text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/60"
              onClick={onClose}
            >
              <Heart size={18} />
              Обране
            </Link>
            <Link
              href="/account"
              className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-[15px] text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/60"
              onClick={onClose}
            >
              <User size={18} />
              Мій кабінет
            </Link>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[var(--color-border)]/60" />

          {/* Contact & info links */}
          <div>
            <a
              href="tel:+380001234567"
              className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-[15px] text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/60"
            >
              <Phone size={18} />
              +38 (000) 123-45-67
            </a>
            <Link
              href="/contacts"
              className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-[15px] text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/60"
              onClick={onClose}
            >
              <MessageCircle size={18} />
              Зворотній зв&apos;язок
            </Link>
            <Link
              href="/faq"
              className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-[15px] text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]/60"
              onClick={onClose}
            >
              <HelpCircle size={18} />
              Питання та відповіді
            </Link>
          </div>

          {/* Social — at the very bottom */}
          <div className="mt-4 flex items-center justify-center gap-3 border-t border-[var(--color-border)]/40 pb-4 pt-4">
            {[
              { href: 'https://t.me/poroshok_shop', label: 'Telegram', Icon: Telegram },
              { href: 'viber://pa?chatURI=poroshok_shop', label: 'Viber', Icon: Viber },
              { href: 'https://instagram.com/poroshok_shop', label: 'Instagram', Icon: Instagram },
              { href: 'https://www.facebook.com/poroshok.shop', label: 'Facebook', Icon: Facebook },
              { href: 'https://www.tiktok.com/@poroshok_shop', label: 'TikTok', Icon: TikTok },
            ].map(({ href, label, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]">
                <Icon size={18} />
              </a>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
