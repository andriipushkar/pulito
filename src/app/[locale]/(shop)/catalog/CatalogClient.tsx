'use client';

import { useState, type ReactNode } from 'react';
import CatalogToolbar from '@/components/catalog/CatalogToolbar';
import FilterSidebar, { type BrandOption } from '@/components/catalog/FilterSidebar';
import MobileFilterSheet from '@/components/catalog/MobileFilterSheet';
import type { CategoryListItem } from '@/types/category';

interface CatalogClientProps {
  total: number;
  categories: CategoryListItem[];
  brands?: BrandOption[];
  children: ReactNode;
}

export default function CatalogClient({
  total,
  categories,
  brands = [],
  children,
}: CatalogClientProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <>
      <CatalogToolbar total={total} onOpenFilters={() => setFiltersOpen(true)} />

      <div className="mt-4 flex gap-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-[140px]">
            <FilterSidebar categories={categories} brands={brands} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <MobileFilterSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
        brands={brands}
      />
    </>
  );
}
