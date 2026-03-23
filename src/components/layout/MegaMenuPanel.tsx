'use client';

import { useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import type { CategoryWithChildren } from '@/types/category';

export interface MegaMenuPanelProps {
  category: CategoryWithChildren;
  onClose: () => void;
  /** Optional promotional banner rendered at the bottom of the panel. */
  promoBanner?: React.ReactNode;
}

/**
 * Mega-menu dropdown panel supporting 3-level category nesting.
 * Hidden on mobile (the mobile menu handles navigation there).
 */
export default function MegaMenuPanel({ category, onClose, promoBanner }: MegaMenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const focusableSelector = 'a[href], button:not([disabled])';

  /* ---- Keyboard navigation ---- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (!panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const idx = focusable.indexOf(document.activeElement as HTMLElement);

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = idx < focusable.length - 1 ? idx + 1 : 0;
        focusable[next]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = idx > 0 ? idx - 1 : focusable.length - 1;
        focusable[prev]?.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const children = category.children ?? [];
  const hasImage = !!category.coverImage;

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={category.name}
      data-testid="mega-menu-panel"
      className="hidden lg:block"
    >
      <div className="rounded-b-[var(--radius)] border border-t-0 border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]">
        <div className="flex">
          {/* ---- Subcategories grid (levels 2 & 3) ---- */}
          <div className={`flex-1 p-6 ${hasImage ? 'pr-0' : ''}`}>
            <div
              className="grid gap-x-8 gap-y-4"
              style={{
                gridTemplateColumns: `repeat(${getColumnCount(children.length, hasImage)}, minmax(0, 1fr))`,
              }}
            >
              {children.map((child) => {
                const grandchildren = child.children ?? [];

                return (
                  <div key={child.id} className="space-y-1">
                    {/* Level 2 heading */}
                    <Link
                      href={`/catalog?category=${child.slug}`}
                      role="menuitem"
                      className="group flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-bg-secondary)]"
                    >
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-[var(--color-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100"
                      />
                      <span className="transition-colors group-hover:text-[var(--color-primary)]">
                        {child.name}
                      </span>
                      <span className="ml-auto text-xs text-[var(--color-text-secondary)]">
                        {child._count.products}
                      </span>
                    </Link>

                    {/* Level 3 grandchildren */}
                    {grandchildren.length > 0 && (
                      <ul className="ml-5 space-y-0.5">
                        {grandchildren.map((gc) => (
                          <li key={gc.id}>
                            <Link
                              href={`/catalog?category=${gc.slug}`}
                              role="menuitem"
                              data-testid="grandchild-link"
                              className="group flex items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
                            >
                              <span className="text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-primary)]">
                                {gc.name}
                              </span>
                              <span className="ml-auto text-xs text-[var(--color-text-secondary)]">
                                {gc._count.products}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {/* "View all" link */}
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <Link
                href={`/catalog?category=${category.slug}`}
                role="menuitem"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] transition-colors hover:underline"
              >
                Дивитись все
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Promotional banner slot */}
            {promoBanner && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4" data-testid="promo-banner">
                {promoBanner}
              </div>
            )}
          </div>

          {/* ---- Cover image (if available) ---- */}
          {hasImage && (
            <div className="relative hidden w-64 shrink-0 overflow-hidden rounded-br-[var(--radius)] xl:block">
              <Image
                src={category.coverImage!}
                alt={category.name}
                fill
                sizes="256px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="text-lg font-semibold text-white">{category.name}</p>
                {category.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-white/80">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Return the number of grid columns based on the child count and whether there is a cover image. */
function getColumnCount(childCount: number, hasCover: boolean): number {
  const maxCols = hasCover ? 3 : 4;
  if (childCount <= 4) return Math.min(2, maxCols);
  if (childCount <= 8) return Math.min(3, maxCols);
  return maxCols;
}
