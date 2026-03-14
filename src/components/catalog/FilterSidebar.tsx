'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CategoryListItem } from '@/types/category';

interface FilterSidebarProps {
  categories: CategoryListItem[];
}

export default function FilterSidebar({ categories }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const PRICE_MIN_DEFAULT = 0;
  const PRICE_MAX_DEFAULT = 10000;

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('category')?.split(',').filter(Boolean) || [],
  );
  const [priceMin, setPriceMin] = useState(searchParams.get('price_min') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('price_max') || '');
  const [promo, setPromo] = useState(searchParams.get('promo') === 'true');
  const [inStock, setInStock] = useState(searchParams.get('in_stock') === 'true');

  const sliderMin = Number(priceMin) || PRICE_MIN_DEFAULT;
  const sliderMax = Number(priceMax) || PRICE_MAX_DEFAULT;

  const handleCategoryToggle = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleSliderMin = (value: number) => {
    const clamped = Math.min(value, sliderMax);
    setPriceMin(clamped === PRICE_MIN_DEFAULT ? '' : String(clamped));
  };

  const handleSliderMax = (value: number) => {
    const clamped = Math.max(value, sliderMin);
    setPriceMax(clamped === PRICE_MAX_DEFAULT ? '' : String(clamped));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (selectedCategories.length > 0) params.set('category', selectedCategories.join(','));
    if (priceMin) params.set('price_min', priceMin);
    if (priceMax) params.set('price_max', priceMax);
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
    setPriceMin('');
    setPriceMax('');
    setPromo(false);
    setInStock(false);
    router.push('/catalog');
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
    // Auto-expand parents whose children are selected
    const expanded = new Set<number>();
    for (const parent of parents) {
      const children = childrenByParent[parent.id] || [];
      if (children.some((c) => selectedCategories.includes(c.slug)) || selectedCategories.includes(parent.slug)) {
        expanded.add(parent.id);
      }
    }
    return expanded;
  });
  const [showAllCategories, setShowAllCategories] = useState(false);

  const MAX_VISIBLE_PARENTS = 8;
  const displayParents = showAllCategories ? parents : parents.slice(0, MAX_VISIBLE_PARENTS);

  const toggleExpand = (id: number) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-white p-5 shadow-[var(--shadow)]">
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Категорії</h3>
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
                      <svg className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  <label className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)] ${!hasChildren ? 'ml-5' : ''}`}>
                    <input
                      type="checkbox"
                      value={cat.slug}
                      checked={selectedCategories.includes(cat.slug)}
                      onChange={() => handleCategoryToggle(cat.slug)}
                      className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                    />
                    <span className="flex-1 font-medium text-[var(--color-text)]">{cat.name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{cat._count.products}</span>
                  </label>
                </div>
                {hasChildren && isExpanded && (
                  <div className="ml-5 border-l border-[var(--color-border)] pl-2">
                    {children.map((child) => (
                      <label key={child.id} className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius)] px-2 py-1 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]">
                        <input
                          type="checkbox"
                          value={child.slug}
                          checked={selectedCategories.includes(child.slug)}
                          onChange={() => handleCategoryToggle(child.slug)}
                          className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                        />
                        <span className="flex-1 text-[var(--color-text)]">{child.name}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{child._count.products}</span>
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
              {showAllCategories ? 'Показати менше' : `Показати ще ${parents.length - MAX_VISIBLE_PARENTS}...`}
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Ціна, ₴</h3>

        {/* Dual-handle range slider */}
        <div className="relative mb-4 h-6">
          <div className="pointer-events-none absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-[var(--color-border)]">
            <div
              className="absolute h-full rounded bg-[var(--color-primary)]"
              style={{
                left: `${(sliderMin / PRICE_MAX_DEFAULT) * 100}%`,
                right: `${100 - (sliderMax / PRICE_MAX_DEFAULT) * 100}%`,
              }}
            />
          </div>
          <input
            type="range"
            min={PRICE_MIN_DEFAULT}
            max={PRICE_MAX_DEFAULT}
            step={50}
            value={sliderMin}
            onChange={(e) => handleSliderMin(Number(e.target.value))}
            className="pointer-events-none absolute top-0 h-full w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--color-primary)] [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--color-primary)] [&::-webkit-slider-thumb]:bg-white"
          />
          <input
            type="range"
            min={PRICE_MIN_DEFAULT}
            max={PRICE_MAX_DEFAULT}
            step={50}
            value={sliderMax}
            onChange={(e) => handleSliderMax(Number(e.target.value))}
            className="pointer-events-none absolute top-0 h-full w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--color-primary)] [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--color-primary)] [&::-webkit-slider-thumb]:bg-white"
          />
        </div>

        {/* Manual number inputs */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Від"
            min={PRICE_MIN_DEFAULT}
            max={PRICE_MAX_DEFAULT}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
          <span className="text-[var(--color-text-secondary)]">—</span>
          <input
            type="number"
            placeholder="До"
            min={PRICE_MIN_DEFAULT}
            max={PRICE_MAX_DEFAULT}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>

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
