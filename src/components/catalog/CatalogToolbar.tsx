'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Select from '@/components/ui/Select';
import { Filter } from '@/components/icons';

interface CatalogToolbarProps {
  total: number;
  onOpenFilters?: () => void;
}

const sortOptions = [
  { value: 'popular', label: 'За популярністю' },
  { value: 'newest', label: 'Новинки' },
  { value: 'price_asc', label: 'Від дешевих' },
  { value: 'price_desc', label: 'Від дорогих' },
  { value: 'name_asc', label: 'За назвою' },
];

export default function CatalogToolbar({ total, onOpenFilters }: CatalogToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'popular';

  const filterKeys = ['category', 'price_min', 'price_max', 'promo', 'in_stock'] as const;
  const activeFilterCount = filterKeys.filter((key) => searchParams.has(key)).length;

  const handleSort = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    params.delete('page');
    router.push(`/catalog?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Знайдено: <strong className="text-[var(--color-text)]">{total}</strong> товарів
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenFilters}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm transition-colors hover:bg-[var(--color-bg-secondary)] lg:hidden"
        >
          <Filter size={16} />
          Фільтри{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>
        <Select
          options={sortOptions}
          value={currentSort}
          onChange={(e) => handleSort(e.target.value)}
          className="w-32 sm:w-40"
        />
      </div>
    </div>
  );
}
