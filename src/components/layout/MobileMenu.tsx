'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Close, Telegram, Viber, Instagram, Heart, User, ChevronRight } from '@/components/icons';
import type { CategoryListItem } from '@/types/category';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryListItem[];
}

export default function MobileMenu({ isOpen, onClose, categories }: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - simple scrollable */}
      <nav
        ref={menuRef}
        role="navigation"
        aria-label="Мобільна навігація"
        className="absolute top-0 bottom-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white shadow-xl"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <span className="text-lg font-bold text-blue-700">Меню</span>
          <button ref={closeButtonRef} onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100" aria-label="Закрити">
            <Close size={24} />
          </button>
        </div>

        {/* Categories */}
        <div className="px-4 py-3">
          {parents.map((cat) => (
            <Link
              key={cat.id}
              href={`/catalog?category=${cat.slug}`}
              className="flex items-center justify-between border-b border-gray-100 px-2 py-3.5 text-[15px] font-medium text-gray-800 last:border-b-0 hover:text-blue-600"
              onClick={onClose}
            >
              <span>{cat.name}</span>
              <ChevronRight size={16} className="text-gray-400" />
            </Link>
          ))}
        </div>

        {/* Promo */}
        <div className="border-t border-gray-200 px-4 py-2">
          <Link
            href="/catalog?promo=true"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-red-500 hover:bg-red-50"
            onClick={onClose}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c.5 2.5 3 5 5 7-1 4-3 7-5 9-2-2-4-5-5-9 2-2 4.5-4.5 5-7z" />
            </svg>
            Акції
          </Link>
        </div>

        {/* Account */}
        <div className="border-t border-gray-200 px-4 py-2">
          <Link
            href="/wishlist"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-blue-600"
            onClick={onClose}
          >
            <Heart size={18} />
            Обране
          </Link>
          <Link
            href="/account"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-blue-600"
            onClick={onClose}
          >
            <User size={18} />
            Мій кабінет
          </Link>
        </div>

        {/* Social */}
        <div className="border-t border-gray-200 px-4 py-4">
          <p className="mb-2 text-xs text-gray-400">Ми в соціальних мережах</p>
          <div className="flex items-center gap-3">
            <a href="#" aria-label="Telegram" className="text-gray-400 hover:text-blue-600">
              <Telegram size={20} />
            </a>
            <a href="#" aria-label="Viber" className="text-gray-400 hover:text-blue-600">
              <Viber size={20} />
            </a>
            <a href="#" aria-label="Instagram" className="text-gray-400 hover:text-blue-600">
              <Instagram size={20} />
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}
