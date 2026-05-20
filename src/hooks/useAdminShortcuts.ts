'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface Options {
  onOpenShortcuts: () => void;
}

// Map of "g + <key>" → admin path
const GOTO_MAP: Record<string, string> = {
  d: '/admin',
  o: '/admin/orders',
  p: '/admin/products',
  u: '/admin/users',
  c: '/admin/categories',
  a: '/admin/analytics',
  s: '/admin/settings',
};

// Map of context → "new" url. Used for `n` shortcut.
function newUrlForPath(pathname: string): string | null {
  if (pathname.startsWith('/admin/products')) return '/admin/products/new';
  if (pathname.startsWith('/admin/categories')) return '/admin/categories?new=1';
  if (pathname.startsWith('/admin/publications')) return '/admin/publications?new=1';
  if (pathname.startsWith('/admin/pages')) return '/admin/pages?new=1';
  if (pathname.startsWith('/admin/campaigns')) return '/admin/campaigns?new=1';
  if (pathname.startsWith('/admin/users')) return '/admin/users?new=1';
  if (pathname.startsWith('/admin/orders')) return '/admin/orders/new';
  return null;
}

/**
 * Global keyboard shortcuts for /admin pages:
 *  - `/` focuses the sidebar search (or the Ctrl+K palette as fallback)
 *  - `?` opens the shortcuts help modal
 *  - `g d/o/p/u/c/a/s` navigates to common admin pages
 *  - `n` triggers context-aware "new" navigation
 *
 * Shortcuts are skipped when the user is typing in a text field.
 */
export function useAdminShortcuts({ onOpenShortcuts }: Options) {
  const router = useRouter();
  const pathname = usePathname();
  // Track time of last `g` key for g-prefix combo
  const gActiveRef = useRef<number>(0);

  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      // Never hijack while typing or when modifier keys are involved (let Ctrl+K etc. through)
      if (isEditable(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // `?` — open shortcut help (require shift since `?` is shift+/)
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // `/` — focus sidebar search input (falls back to opening Ctrl+K palette)
      if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>(
          'aside input[type="search"], aside input[aria-label="Пошук у меню"]'
        );
        if (search) {
          e.preventDefault();
          search.focus();
        } else {
          e.preventDefault();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        }
        return;
      }

      // `n` — context-aware new
      if (e.key === 'n') {
        const href = newUrlForPath(pathname || '');
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }

      // `g` — start go-to combo (window is 1.2s)
      if (e.key === 'g') {
        gActiveRef.current = Date.now();
        return;
      }

      // Second key after `g`
      if (gActiveRef.current && Date.now() - gActiveRef.current < 1200) {
        const dest = GOTO_MAP[e.key.toLowerCase()];
        gActiveRef.current = 0;
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router, pathname, onOpenShortcuts]);
}
