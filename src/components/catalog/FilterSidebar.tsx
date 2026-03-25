'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CategoryListItem } from '@/types/category';
import DualRangeSlider from '@/components/ui/DualRangeSlider';
import FilterChips, { type FilterChip } from '@/components/catalog/FilterChips';

export interface BrandOption {
  slug: string;
  name: string;
  count?: number;
}

interface FilterSidebarProps {
  categories: CategoryListItem[];
  brands?: BrandOption[];
}

export default function FilterSidebar({ categories, brands = [] }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const PRICE_MIN_DEFAULT = 0;
  const PRICE_MAX_DEFAULT = 10000;
  const PRICE_STEP = 50;

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('category')?.split(',').filter(Boolean) || [],
  );

  const initialMin = Number(searchParams.get('price_min')) || PRICE_MIN_DEFAULT;
  const initialMax = Number(searchParams.get('price_max')) || PRICE_MAX_DEFAULT;
  const [priceRange, setPriceRange] = useState<[number, number]>([initialMin, initialMax]);

  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    searchParams.get('brand')?.split(',').filter(Boolean) || [],
  );
  const [promo, setPromo] = useState(searchParams.get('promo') === 'true');
  const [inStock, setInStock] = useState(searchParams.get('in_stock') === 'true');

  const handleCategoryToggle = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleBrandToggle = (slug: string) => {
    setSelectedBrands((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (selectedCategories.length > 0) params.set('category', selectedCategories.join(','));
    if (priceRange[0] !== PRICE_MIN_DEFAULT) params.set('price_min', String(priceRange[0]));
    if (priceRange[1] !== PRICE_MAX_DEFAULT) params.set('price_max', String(priceRange[1]));
    if (selectedBrands.length > 0) params.set('brand', selectedBrands.join(','));
    if (promo) params.set('promo', 'true');
    if (inStock) params.set('in_stock', 'true');
    const search = searchParams.get('search');
    if (search) params.set('search', search);
    const sort = searchParams.get('sort');
    if (sort) params.set('sort', sort);
    router.push(`/catalog?${params.toString()}`);
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    setPriceRange([PRICE_MIN_DEFAULT, PRICE_MAX_DEFAULT]);
    setSelectedBrands([]);
    setPromo(false);
    setInStock(false);
    router.push('/catalog');
  };

  // Build active filter chips
  const activeChips = useMemo(() => {
    const chips: FilterChip[] = [];
    if (priceRange[0] !== PRICE_MIN_DEFAULT) {
      chips.push({ key: 'price_min', label: 'Ціна від', value: `${priceRange[0]} ₴` });
    }
    if (priceRange[1] !== PRICE_MAX_DEFAULT) {
      chips.push({ key: 'price_max', label: 'Ціна до', value: `${priceRange[1]} ₴` });
    }
    for (const slug of selectedCategories) {
      const cat = categories.find((c) => c.slug === slug);
      chips.push({ key: `category_${slug}`, label: 'Категорія', value: cat?.name || slug });
    }
    for (const slug of selectedBrands) {
      const brand = brands.find((b) => b.slug === slug);
      chips.push({ key: `brand_${slug}`, label: 'Бренд', value: brand?.name || slug });
    }
    if (promo) chips.push({ key: 'promo', label: 'Фільтр', value: 'Акційні' });
    if (inStock) chips.push({ key: 'in_stock', label: 'Фільтр', value: 'В наявності' });
    return chips;
  }, [priceRange, selectedCategories, selectedBrands, promo, inStock, categories, brands]);

  const handleChipRemove = (key: string) => {
    if (key === 'price_min') setPriceRange([PRICE_MIN_DEFAULT, priceRange[1]]);
    else if (key === 'price_max') setPriceRange([priceRange[0], PRICE_MAX_DEFAULT]);
    else if (key.startsWith('category_')) {
      const slug = key.replace('category_', '');
      setSelectedCategories((prev) => prev.filter((s) => s !== slug));
    } else if (key.startsWith('brand_')) {
      const slug = key.replace('brand_', '');
      setSelectedBrands((prev) => prev.filter((s) => s !== slug));
    } else if (key === 'promo') setPromo(false);
    else if (key === 'in_stock') setInStock(false);
  };

  const parents = categories.filter((c) => !c.parentId);
  const childrenByParent = useMemo(() => {
    const map: Record<number, CategoryListItem[]> = {};
    for (const c of categories) {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    }
    return map;
  }, [categories]);

  const [expandedParents, setExpandedParents] = useState<Set<number>>(() => {
    const expanded = new Set<number>();
    for (const parent of parents) {
      const children = childrenByParent[parent.id] || [];
      if (
        children.some((c) => selectedCategories.includes(c.slug)) ||
        selectedCategories.includes(parent.slug)
      ) {
        expanded.add(parent.id);
      }
    }
    return expanded;
  });
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);

  const MAX_VISIBLE_PARENTS = 8;
  const MAX_VISIBLE_BRANDS = 8;
  const displayParents = showAllCategories ? parents : parents.slice(0, MAX_VISIBLE_PARENTS);
  const displayBrands = showAllBrands ? brands : brands.slice(0, MAX_VISIBLE_BRANDS);

  const toggleExpand = (id: number) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-white p-5 shadow-[var(--shadow)]">
      {/* Active Filter Chips */}
      <FilterChips filters={activeChips} onRemove={handleChipRemove} onClearAll={resetFilters} />

      {/* Categories */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Категорії
        </h3>
        <div className="flex flex-col gap-0.5">
          {displayParents.map((cat) => {
            const children = childrenByParent[cat.id] || [];
            const hasChildren = children.length > 0;
            const isExpanded = expandedParents.has(cat.id);

            return (
              <div key={cat.id}>
                <div className="flex items-center">
                  {hasChildren && (
                    <button
                      onClick={() => toggleExpand(cat.id)}
                      className="shrink-0 rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                      aria-label={isExpanded ? 'Згорнути' : 'Розгорнути'}
                    >
                      <svg
                        className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  <label
                    className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)] ${!hasChildren ? 'ml-5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      value={cat.slug}
                      checked={selectedCategories.includes(cat.slug)}
                      onChange={() => handleCategoryToggle(cat.slug)}
                      className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                    />
                    <span className="flex-1 font-medium text-[var(--color-text)]">{cat.name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {cat._count.products}
                    </span>
                  </label>
                </div>
                {hasChildren && isExpanded && (
                  <div className="ml-5 border-l border-[var(--color-border)] pl-2">
                    {children.map((child) => (
                      <label
                        key={child.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius)] px-2 py-1 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
                      >
                        <input
                          type="checkbox"
                          value={child.slug}
                          checked={selectedCategories.includes(child.slug)}
                          onChange={() => handleCategoryToggle(child.slug)}
                          className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                        />
                        <span className="flex-1 text-[var(--color-text)]">{child.name}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {child._count.products}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {parents.length > MAX_VISIBLE_PARENTS && (
            <button
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="mt-1 px-2 text-left text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              {showAllCategories
                ? 'Показати менше'
                : `Показати ще ${parents.length - MAX_VISIBLE_PARENTS}...`}
            </button>
          )}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Ціна, ₴
        </h3>
        <DualRangeSlider
          min={PRICE_MIN_DEFAULT}
          max={PRICE_MAX_DEFAULT}
          value={priceRange}
          onChange={setPriceRange}
          step={PRICE_STEP}
          formatLabel={(v) => `${v} ₴`}
        />
        {/* Manual number inputs */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            placeholder="Від"
            aria-label="Мінімальна ціна"
            min={PRICE_MIN_DEFAULT}
            max={PRICE_MAX_DEFAULT}
            value={priceRange[0] === PRICE_MIN_DEFAULT ? '' : priceRange[0]}
            onChange={(e) => {
              const v = Number(e.target.value) || PRICE_MIN_DEFAULT;
              setPriceRange([Math.min(v, priceRange[1]), priceRange[1]]);
            }}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
          <span className="text-[var(--color-text-secondary)]">—</span>
          <input
            type="number"
            placeholder="До"
            aria-label="Максимальна ціна"
            min={PRICE_MIN_DEFAULT}
            max={PRICE_MAX_DEFAULT}
            value={priceRange[1] === PRICE_MAX_DEFAULT ? '' : priceRange[1]}
            onChange={(e) => {
              const v = Number(e.target.value) || PRICE_MAX_DEFAULT;
              setPriceRange([priceRange[0], Math.max(v, priceRange[0])]);
            }}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Brand Multi-Select */}
      {brands.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Бренд
          </h3>
          <div className="flex flex-col gap-0.5">
            {displayBrands.map((brand) => (
              <label
                key={brand.slug}
                className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                <input
                  type="checkbox"
                  value={brand.slug}
                  checked={selectedBrands.includes(brand.slug)}
                  onChange={() => handleBrandToggle(brand.slug)}
                  className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                />
                <span className="flex-1 font-medium text-[var(--color-text)]">{brand.name}</span>
                {brand.count !== undefined && (
                  <span className="text-xs text-[var(--color-text-secondary)]">{brand.count}</span>
                )}
              </label>
            ))}
            {brands.length > MAX_VISIBLE_BRANDS && (
              <button
                onClick={() => setShowAllBrands(!showAllBrands)}
                className="mt-1 px-2 text-left text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                {showAllBrands
                  ? 'Показати менше'
                  : `Показати ще ${brands.length - MAX_VISIBLE_BRANDS}...`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Checkboxes */}
      <div className="flex flex-col gap-1">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]">
          <input
            type="checkbox"
            checked={promo}
            onChange={(e) => setPromo(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
          />
          Тільки акційні
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
          />
          В наявності
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={applyFilters}
          className="flex-1 rounded-[var(--radius)] bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Застосувати
        </button>
        <button
          onClick={resetFilters}
          className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          Скинути
        </button>
      </div>
    </div>
  );
}
