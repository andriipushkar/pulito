'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  AtSign,
  Clock,
  Download,
  Hash,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ADMIN_PAGES } from '@/app/(admin)/_lib/admin-pages';

interface CommandItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: string;
  /** Marks an item as a quick-action ("Create new X") rather than just navigation. */
  isAction?: boolean;
}

const RECENT_KEY = 'admin-command-palette-recent';
const RECENT_MAX = 5;
const PINNED_KEY = 'admin-sidebar-pinned';

function getPinned(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(href: string) {
  try {
    const prev = getRecent().filter((h) => h !== href);
    const next = [href, ...prev].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// Navigation commands derived from the single ADMIN_PAGES registry. Section
// label defaults to the registry section, or "Основне" for top-level items.
const NAV_COMMANDS: CommandItem[] = ADMIN_PAGES.filter((p) => !p.hiddenFromSidebar).map((p) => ({
  label: p.label,
  href: p.href,
  icon: p.icon,
  section: p.section ?? 'Основне',
}));

// Quick actions — creation + saved-filter shortcuts. Kept hand-curated because
// they target query-string variants of pages rather than the pages themselves.
const QUICK_ACTIONS: CommandItem[] = [
  { label: '+ Створити товар', href: '/admin/products/new', icon: Plus, section: 'Дії', isAction: true },
  { label: '+ Створити сторінку', href: '/admin/pages?new=1', icon: Plus, section: 'Дії', isAction: true },
  { label: '+ Нова публікація', href: '/admin/publications?new=1', icon: Plus, section: 'Дії', isAction: true },
  { label: '+ Імпортувати каталог', href: '/admin/import', icon: Download, section: 'Дії', isAction: true },
  { label: '+ Нове замовлення', href: '/admin/orders', icon: Plus, section: 'Дії', isAction: true },
  { label: 'Нові замовлення', href: '/admin/orders?status=new_order', icon: Sparkles, section: 'Дії', isAction: true },
  { label: 'Гуртові запити', href: '/admin/users?wholesaleStatus=pending', icon: Clock, section: 'Дії', isAction: true },
  { label: 'Низькі залишки', href: '/admin/products?stock=low', icon: AlertTriangle, section: 'Дії', isAction: true },
  { label: 'Немає в наявності', href: '/admin/products?stock=out', icon: XCircle, section: 'Дії', isAction: true },
];

const COMMANDS: CommandItem[] = [...NAV_COMMANDS, ...QUICK_ACTIONS];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Track every visited admin page (independent of palette opens)
  useEffect(() => {
    if (pathname && pathname.startsWith('/admin')) pushRecent(pathname);
  }, [pathname]);

  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const qOriginal = query.trim();
    const q = qOriginal.toLowerCase();

    // Phone-like (≥7 digits, mostly numeric) — search orders & users by phone.
    const digits = q.replace(/\D+/g, '');
    const isMostlyDigits = digits.length >= 7 && digits.length / Math.max(q.length, 1) > 0.6;
    if (isMostlyDigits) {
      const phoneActions: CommandItem[] = [];
      // 8-14 digits → likely an EAN/UPC barcode. Prioritize barcode lookup.
      if (digits.length >= 8 && digits.length <= 14) {
        phoneActions.push({
          label: `Товар за штрихкодом ${digits}`,
          href: `/admin/products?barcode=${encodeURIComponent(digits)}`,
          icon: Hash,
          section: 'Пошук',
          isAction: true,
        });
      }
      phoneActions.push(
        {
          label: `Замовлення з номером ${qOriginal}`,
          href: `/admin/orders?search=${encodeURIComponent(qOriginal)}`,
          icon: Phone,
          section: 'Пошук',
          isAction: true,
        },
        {
          label: `Клієнт з номером ${qOriginal}`,
          href: `/admin/users?search=${encodeURIComponent(qOriginal)}`,
          icon: Phone,
          section: 'Пошук',
          isAction: true,
        },
        {
          label: `Замовлення №${digits}`,
          href: `/admin/orders?search=${encodeURIComponent(digits)}`,
          icon: Hash,
          section: 'Пошук',
          isAction: true,
        },
      );
      const rest = COMMANDS.filter(
        (c) => c.label.toLowerCase().includes(q) || c.href.toLowerCase().includes(q),
      );
      return [...phoneActions, ...rest];
    }

    // Email-like — search users by email.
    if (q.includes('@')) {
      const emailActions: CommandItem[] = [
        {
          label: `Клієнт за email "${qOriginal}"`,
          href: `/admin/users?search=${encodeURIComponent(qOriginal)}`,
          icon: AtSign,
          section: 'Пошук',
          isAction: true,
        },
      ];
      const rest = COMMANDS.filter(
        (c) => c.label.toLowerCase().includes(q) || c.href.toLowerCase().includes(q),
      );
      return [...emailActions, ...rest];
    }

    // Product code / SKU-like (3+ chars, mix of letters and digits, no spaces)
    if (qOriginal.length >= 3 && !qOriginal.includes(' ') && /\d/.test(qOriginal) && /[a-zа-я]/i.test(qOriginal)) {
      const skuActions: CommandItem[] = [
        {
          label: `Товар за артикулом "${qOriginal}"`,
          href: `/admin/products?search=${encodeURIComponent(qOriginal)}`,
          icon: ShoppingBag,
          section: 'Пошук',
          isAction: true,
        },
      ];
      const rest = COMMANDS.filter(
        (c) => c.label.toLowerCase().includes(q) || c.href.toLowerCase().includes(q),
      );
      return [...skuActions, ...rest];
    }

    if (!q) {
      // Empty query: Pinned → Quick Actions → Recently Visited → everything else.
      const pinnedItems = pinnedHrefs
        .map((h) => COMMANDS.find((c) => c.href === h))
        .filter((c): c is CommandItem => Boolean(c))
        .map((c) => ({ ...c, section: 'Закріплене' }));
      const actions = COMMANDS.filter((c) => c.isAction);
      const recentItems = recentHrefs
        .filter((h) => !pinnedHrefs.includes(h))
        .map((h) => COMMANDS.find((c) => c.href === h))
        .filter((c): c is CommandItem => Boolean(c) && !c!.isAction)
        .map((c) => ({ ...c, section: 'Нещодавно' }));
      const seen = new Set([
        ...pinnedItems.map((p) => p.href),
        ...actions.map((a) => a.href),
        ...recentItems.map((r) => r.href),
      ]);
      const rest = COMMANDS.filter((c) => !c.isAction && !seen.has(c.href));
      return [...pinnedItems, ...actions, ...recentItems, ...rest];
    }

    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.href.toLowerCase().includes(q),
    );
  }, [query, recentHrefs, pinnedHrefs]);

  // Open/close is centralized so we can reset state on open without an effect
  // that calls setState in response to `isOpen` flipping.
  const openPalette = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    setRecentHrefs(getRecent());
    setPinnedHrefs(getPinned());
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);
  const closePalette = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === 'k' && e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) closePalette();
        else openPalette();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openPalette, closePalette]);

  // selectedIndex resets in the input onChange below.

  const navigate = useCallback(
    (href: string) => {
      setIsOpen(false);
      pushRecent(href);
      router.push(href);
    },
    [router],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Швидкий перехід"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4">
          <Search
            size={18}
            strokeWidth={2}
            className="shrink-0 text-[var(--color-text-secondary)]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Шукай товар, замовлення, клієнта, сторінку…"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-[var(--color-text-secondary)]"
          />
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              Нічого не знайдено
            </p>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              return (
              <button
                key={item.href + (item.isAction ? '-a' : '')}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  i === selectedIndex
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <Icon size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
                <span className="font-medium">{item.label}</span>
                {item.section && (
                  <span
                    className={`ml-auto text-xs ${i === selectedIndex ? 'text-white/70' : 'text-[var(--color-text-secondary)]'}`}
                  >
                    {item.section}
                  </span>
                )}
              </button>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-[var(--color-border)] px-4 py-2">
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1 font-mono">↑↓</kbd>
            навігація
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1 font-mono">↵</kbd>
            перейти
          </span>
          <span className="ml-auto hidden text-[10px] text-[var(--color-text-secondary)] sm:inline">
            Підказка: введи телефон, email або артикул для пошуку клієнта/замовлення/товару
          </span>
        </div>
      </div>
    </div>
  );
}
