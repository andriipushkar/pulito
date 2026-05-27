'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import Container from '@/components/ui/Container';
import MegaMenuPanel from '@/components/layout/MegaMenuPanel';
import { ChevronDown } from '@/components/icons';
import type { CategoryListItem } from '@/types/category';
import type { CategoryWithChildren } from '@/types/category';

interface CategoryNavProps {
  categories: CategoryListItem[];
  shrink?: boolean;
}

/** Build a tree of CategoryWithChildren from the flat list (supports 3 levels). */
function buildTree(categories: CategoryListItem[]): CategoryWithChildren[] {
  const map = new Map<number, CategoryWithChildren>();
  for (const c of categories) {
    map.set(c.id, { ...c, children: [] });
  }
  const roots: CategoryWithChildren[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else if (!node.parentId) {
      roots.push(node);
    }
  }
  return roots;
}

export default function CategoryNav({ categories, shrink }: CategoryNavProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const tree = buildTree(categories);
  // Trust the server's order (sortOrder asc, name asc) — the admin drag-n-drop
  // writes sequential sortOrder values starting at 0, and the previous custom
  // sort here treated sortOrder=0 as "not manually ordered" and moved it to
  // the alphabetical bucket. Result: admin and storefront disagreed on order
  // after the first reorder.
  const visibleParents = tree;

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
        <ul
          className={`flex items-center justify-center gap-1 overflow-hidden transition-all duration-300 ${shrink ? 'py-1' : 'py-2'}`}
        >
          {/* Static catalog link — primary action, white-on-blue with subtle pop */}
          <li>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition-all hover:bg-white hover:text-[var(--color-primary-dark)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
              Каталог
            </Link>
          </li>

          {/* Static "Акції" link — accent via icon color only, same shape as other nav items */}
          {!visibleParents.some((c) => /акці|sale|promo/i.test(c.slug)) && (
            <li>
              <Link
                href="/catalog?promo=true"
                className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-all hover:bg-white/10 hover:text-white"
              >
                <svg
                  className="h-4 w-4 text-[var(--color-gold-light)] transition-colors group-hover:text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2c.5 2.5 3 5 5 7-1 4-3 7-5 9-2-2-4-5-5-9 2-2 4.5-4.5 5-7z" />
                </svg>
                Акції
              </Link>
            </li>
          )}

          {visibleParents.map((cat) => {
            const hasChildren = cat.children.length > 0;
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
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isOpen
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="max-w-[160px] truncate">{cat.name}</span>
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
                      <MegaMenuPanel
                        category={cat}
                        onClose={() => {
                          setVisible(false);
                          setTimeout(() => setOpenId(null), 200);
                        }}
                      />
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
