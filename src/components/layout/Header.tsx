'use client';

import TopBar from './TopBar';
import HeaderMain from './HeaderMain';
import CategoryNav from './CategoryNav';
import type { CategoryListItem } from '@/types/category';

interface HeaderProps {
  categories: CategoryListItem[];
}

export default function Header({ categories }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--color-bg)]/95 shadow-[var(--shadow-md)] backdrop-blur-md">
      <TopBar />
      <HeaderMain categories={categories} />
      <CategoryNav categories={categories} />
    </header>
  );
}
