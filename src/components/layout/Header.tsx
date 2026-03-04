'use client';

import { useState, useEffect } from 'react';
import TopBar from './TopBar';
import HeaderMain from './HeaderMain';
import CategoryNav from './CategoryNav';
import type { CategoryListItem } from '@/types/category';

interface HeaderProps {
  categories: CategoryListItem[];
}

export default function Header({ categories }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-bg)]/95 shadow-[var(--shadow-md)] backdrop-blur-md">
      <div
        className={`transition-all duration-300 overflow-hidden ${
          scrolled ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'
        }`}
      >
        <TopBar />
      </div>
      <HeaderMain categories={categories} shrink={scrolled} />
      <CategoryNav categories={categories} shrink={scrolled} />
    </header>
  );
}
