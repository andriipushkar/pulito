'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import { ChevronDown, ChevronRight } from '@/components/icons';
import type { CategoryListItem } from '@/types/category';

interface CategoryNavProps {
  categories: CategoryListItem[];
}

/** Return the number of grid columns based on the child count and whether there is a cover image. */
function getColumnCount(childCount: number, hasCover: boolean): number {
  const maxCols = hasCover ? 3 : 4;
  if (childCount <= 4) return Math.min(2, maxCols);
  if (childCount <= 8) return Math.min(3, maxCols);
  return maxCols;
}

export default function CategoryNav({ categories }: CategoryNavProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const parents = categories.filter((c) => !c.parentId);

  /* ---- hover helpers with a small delay to avoid flicker ---- */
  const openMenu = useCallback((id: number) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenId(id);
    // Allow the DOM to mount, then enable the CSS transition
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const closeMenu = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setVisible(false);
      // Wait for the fade-out transition before unmounting
      setTimeout(() => setOpenId(null), 200);
    }, 100);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openId !== null) {
        setVisible(false);
        setTimeout(() => setOpenId(null), 200);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openId]);

  return (
    <nav
      ref={navRef}
      className="relative hidden bg-gradient-to-r from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[var(--color-primary-dark)] lg:block"
      aria-label="Категорії"
    >
      <Container>
        <ul className="flex items-center justify-center gap-2 overflow-x-auto py-2 scrollbar-hide">
          {/* Static catalog link */}
          <li>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-gold-dark)] to-[var(--color-gold)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-gold)] transition-all hover:from-[var(--color-gold)] hover:to-[var(--color-gold-light)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              Каталог
            </Link>
          </li>

          {/* Static "Акції" link */}
          {!parents.some((c) => /акці|sale|promo/i.test(c.slug)) && (
            <li>
              <Link
                href="/catalog?promo=true"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#F44336] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2c.5 2.5 3 5 5 7-1 4-3 7-5 9-2-2-4-5-5-9 2-2 4.5-4.5 5-7z" />
                </svg>
                Акції
              </Link>
            </li>
          )}

          {parents.map((cat) => {
            const children = categories.filter((c) => c.parentId === cat.id);
            const hasChildren = children.length > 0;
            const isOpen = openId === cat.id;

            return (
              <li
                key={cat.id}
                className="static"
                onMouseEnter={() => (hasChildren ? openMenu(cat.id) : undefined)}
                onMouseLeave={() => (hasChildren ? closeMenu() : undefined)}
              >
                <Link
                  href={`/catalog?category=${cat.slug}`}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                    isOpen
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {cat.name}
                  {hasChildren && (
                    <ChevronDown
                      size={14}
                      className={`opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  )}
                </Link>

                {/* ---------- MEGA-MENU ---------- */}
                {hasChildren && isOpen && (
                  <div
                    className={`absolute inset-x-0 top-full z-50 transition-all duration-200 ${
                      visible
                        ? 'pointer-events-auto translate-y-0 opacity-100'
                        : 'pointer-events-none -translate-y-1 opacity-0'
                    }`}
                    onMouseEnter={() => openMenu(cat.id)}
                    onMouseLeave={closeMenu}
                  >
                    <Container>
                      <div className="rounded-b-[var(--radius)] border border-t-0 border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]">
                        <div className="flex">
                          {/* ---- Subcategories grid ---- */}
                          <div className={`flex-1 p-6 ${cat.coverImage ? 'pr-0' : ''}`}>
                            <div
                              className="grid gap-x-8 gap-y-1"
                              style={{
                                gridTemplateColumns: `repeat(${getColumnCount(children.length, !!cat.coverImage)}, minmax(0, 1fr))`,
                              }}
                            >
                              {children.map((child) => (
                                <Link
                                  key={child.id}
                                  href={`/catalog?category=${child.slug}`}
                                  className="group flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
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
                              ))}
                            </div>

                            {/* ---- "View all" link ---- */}
                            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                              <Link
                                href={`/catalog?category=${cat.slug}`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] transition-colors hover:underline"
                              >
                                Дивитись все
                                <ChevronRight size={14} />
                              </Link>
                            </div>
                          </div>

                          {/* ---- Cover image (if available) ---- */}
                          {cat.coverImage && (
                            <div className="relative hidden w-64 shrink-0 overflow-hidden rounded-br-[var(--radius)] xl:block">
                              <Image
                                src={cat.coverImage}
                                alt={cat.name}
                                fill
                                sizes="256px"
                                className="object-cover"
                              />
                              {/* Gradient overlay for text readability */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                              <div className="absolute inset-x-0 bottom-0 p-4">
                                <p className="text-lg font-semibold text-white">{cat.name}</p>
                                {cat.description && (
                                  <p className="mt-1 line-clamp-2 text-sm text-white/80">
                                    {cat.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Container>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}
