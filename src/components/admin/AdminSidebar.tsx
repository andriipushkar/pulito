'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Globe, LogOut, Search, Star, X } from 'lucide-react';
import { Close } from '@/components/icons';
import { useSidebarCounts } from '@/hooks/useSidebarCounts';
import ThemeToggle from '@/components/admin/ThemeToggle';
import SiteLogo from '@/components/common/SiteLogo';
import {
  ADMIN_PAGES,
  getNavSections,
  type AdminPage,
  type NavSection,
} from '@/app/(admin)/_lib/admin-pages';

const PINNED_KEY = 'admin-sidebar-pinned';
const EXPANDED_KEY = 'admin-sidebar-expanded-sections';

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Called when the user clicks a link inside the mobile drawer. */
  onNavigate?: () => void;
  /** Mobile-only X button handler. When omitted, the close button is hidden. */
  onCloseMobile?: () => void;
  userLabel: string;
  userRole: string;
  onLogout: () => void;
  /** Show platform-only sections (Tenants, Billing, etc). */
  isPlatformAdmin?: boolean;
}

export default function AdminSidebar({
  collapsed,
  onToggleCollapse,
  onNavigate,
  onCloseMobile,
  userLabel,
  userRole,
  onLogout,
  isPlatformAdmin = false,
}: Props) {
  const t = useTranslations('admin.adminSidebar');
  const tNav = useTranslations('admin.adminNav');
  const pathname = usePathname();
  const sidebarCounts = useSidebarCounts();
  const [pinned, setPinned] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(PINNED_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      // Drop hrefs that no longer exist in the registry (e.g. page removed)
      const known = new Set(ADMIN_PAGES.map((p) => p.href));
      return parsed.filter((h) => known.has(h));
    } catch {
      return [];
    }
  });
  const [query, setQuery] = useState('');

  const togglePin = (href: string) => {
    setPinned((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      try {
        localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const baseSections = useMemo(() => getNavSections(isPlatformAdmin), [isPlatformAdmin]);

  // Section title is the source-of-truth key for expansion. Auto-expand the
  // section containing the active page + Огляд + any previously expanded ones.
  const activeSectionTitle = useMemo(() => {
    if (!pathname) return null;
    for (const sec of baseSections) {
      if (sec.items.some((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href)))) {
        return sec.title ?? null;
      }
    }
    return null;
  }, [baseSections, pathname]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(EXPANDED_KEY);
        if (raw) {
          for (const t of JSON.parse(raw) as string[]) initial.add(t);
        }
      } catch {
        // ignore
      }
    }
    return initial;
  });

  // Keep the active section open whenever the route changes.
  useEffect(() => {
    if (activeSectionTitle && !expandedSections.has(activeSectionTitle)) {
      setExpandedSections((prev) => new Set(prev).add(activeSectionTitle));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionTitle]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const sections = useMemo<NavSection[]>(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      // Search only over baseSections (which already applies the
      // isPlatformAdmin filter). Searching ADMIN_PAGES directly let
      // non-platform admins find and navigate to Tenants/Billing.
      const allowed = new Set<string>();
      for (const s of baseSections) {
        for (const i of s.items) allowed.add(i.href);
      }
      const flat = ADMIN_PAGES.filter(
        (p) =>
          !p.hiddenFromSidebar && allowed.has(p.href) && tNav(p.label).toLowerCase().includes(q),
      );
      return flat.length ? [{ items: flat }] : [];
    }

    if (!pinned.length) return baseSections;

    const pinnedItems = pinned
      .map((href) => ADMIN_PAGES.find((p) => p.href === href))
      .filter((p): p is AdminPage => Boolean(p));
    const pinnedSet = new Set(pinned);
    // Hide pinned items from their original section to avoid duplicates.
    const trimmed = baseSections
      .map((s) => ({ ...s, items: s.items.filter((i) => !pinnedSet.has(i.href)) }))
      .filter((s) => s.items.length);

    return [{ items: pinnedItems }, ...trimmed];
  }, [query, pinned, baseSections, tNav]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : (pathname?.startsWith(href) ?? false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
        {!collapsed && <SiteLogo href="/admin" />}
        <button
          onClick={onToggleCollapse}
          className="hidden rounded-[var(--radius)] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)] lg:block"
          aria-label={collapsed ? t('expandMenu') : t('collapseMenu')}
          title={collapsed ? t('expand') : t('collapse')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {collapsed ? (
              <>
                <path d="M13 17l5-5-5-5" />
                <path d="M6 17l5-5-5-5" />
              </>
            ) : (
              <>
                <path d="M11 17l-5-5 5-5" />
                <path d="M18 17l-5-5 5-5" />
              </>
            )}
          </svg>
        </button>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="lg:hidden" aria-label={t('closeMenu')}>
            <Close size={20} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="border-b border-[var(--color-border)] px-3 py-2">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={2}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchAria')}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-7 pr-7 text-xs outline-none placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
                aria-label={t('clearSearch')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={t('mainMenu')}>
        {sections.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)]">
            {t('nothingFound')}
          </p>
        )}
        {sections.map((section, si) => {
          // Show a "📌 Закріплене" heading for the prepended pin group (only when
          // no search is active — search renders a single flat list).
          const isPinnedSection = !query && pinned.length > 0 && si === 0;
          // sectionTitle is the stable logic key (section key, or a sentinel for
          // the pinned group); sectionLabel is the translated display text.
          const sectionTitle = isPinnedSection ? '__pinned__' : section.title;
          const sectionLabel = isPinnedSection
            ? t('pinnedHeading')
            : section.title
              ? tNav(section.title)
              : '';
          // Pinned + search results are always expanded. Other sections
          // collapse, except the one containing the active route.
          const alwaysOpen = isPinnedSection || !!query || !sectionTitle || collapsed;
          const isExpanded =
            alwaysOpen || expandedSections.has(sectionTitle) || sectionTitle === activeSectionTitle;
          return (
            <div key={(section.title ?? '_top') + si} className="mb-3">
              {sectionTitle &&
                !collapsed &&
                (alwaysOpen && isPinnedSection ? (
                  <p className="mb-1 flex items-center gap-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    <Star size={10} fill="currentColor" aria-hidden />
                    {sectionLabel}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(sectionTitle)}
                    className="mb-1 flex w-full items-center justify-between gap-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                    aria-expanded={isExpanded}
                  >
                    <span>{sectionLabel}</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-150 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                      aria-hidden
                    />
                  </button>
                ))}
              {sectionTitle && collapsed && (
                <div className="mx-auto mb-1 h-px w-8 bg-[var(--color-border)]" />
              )}
              {!isExpanded ? null : (
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const badgeCount = item.badgeKey ? sidebarCounts[item.badgeKey] : 0;
                    const active = isActive(item.href, item.exact);
                    const isPinned = pinned.includes(item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href} className="group relative">
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          title={
                            collapsed
                              ? `${tNav(item.label)}${badgeCount > 0 ? ` (${badgeCount})` : ''}`
                              : undefined
                          }
                          className={`relative flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            active
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                          }`}
                        >
                          <span className="relative shrink-0">
                            <Icon size={collapsed ? 20 : 18} strokeWidth={1.75} aria-hidden />
                            {collapsed && badgeCount > 0 && (
                              <span
                                className="absolute -right-1.5 -top-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white"
                                aria-label={t('newCount', { count: badgeCount })}
                              >
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </span>
                            )}
                          </span>
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{tNav(item.label)}</span>
                              {badgeCount > 0 && (
                                <span
                                  className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                    active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                                  }`}
                                  aria-label={t('newCount', { count: badgeCount })}
                                >
                                  {badgeCount > 99 ? '99+' : badgeCount}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                        {!collapsed && (
                          <button
                            onClick={() => togglePin(item.href)}
                            className={`absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity ${
                              isPinned
                                ? 'text-amber-400 opacity-100 hover:text-amber-500'
                                : 'text-[var(--color-text-secondary)] opacity-0 hover:text-amber-500 group-hover:opacity-60 focus:opacity-100'
                            } ${active ? 'hover:bg-white/10' : 'hover:bg-[var(--color-border)]'}`}
                            aria-label={isPinned ? t('unpin') : t('pin')}
                            title={isPinned ? t('unpin') : t('pin')}
                          >
                            <Star
                              size={12}
                              fill={isPinned ? 'currentColor' : 'none'}
                              strokeWidth={2}
                              aria-hidden
                            />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <ProfileChip
        collapsed={collapsed}
        userLabel={userLabel}
        userRole={userRole}
        onLogout={onLogout}
      />
    </div>
  );
}

function ProfileChip({
  collapsed,
  userLabel,
  userRole,
  onLogout,
}: {
  collapsed: boolean;
  userLabel: string;
  userRole: string;
  onLogout: () => void;
}) {
  const t = useTranslations('admin.adminSidebar');
  const [open, setOpen] = useState(false);
  const initial = userLabel?.[0]?.toUpperCase() || '?';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-profile-menu]')) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (collapsed) {
    return (
      <div className="border-t border-[var(--color-border)] px-2 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-center rounded-lg p-2 hover:bg-[var(--color-bg-secondary)]"
          aria-label={t('profile')}
          data-profile-menu
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
            {initial}
          </span>
        </button>
        {open && (
          <ProfileMenu
            collapsed
            onLogout={onLogout}
            onClose={() => setOpen(false)}
            userLabel={userLabel}
            userRole={userRole}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative border-t border-[var(--color-border)] px-2 py-2" data-profile-menu>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--color-bg-secondary)] ${
          open ? 'bg-[var(--color-bg-secondary)]' : ''
        }`}
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--color-text)]">
            {userLabel}
          </span>
          <span className="block truncate text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            {userRole}
          </span>
        </span>
        {open ? (
          <ChevronDown
            size={14}
            className="shrink-0 text-[var(--color-text-secondary)]"
            aria-hidden
          />
        ) : (
          <ChevronUp
            size={14}
            className="shrink-0 text-[var(--color-text-secondary)]"
            aria-hidden
          />
        )}
      </button>
      {open && (
        <ProfileMenu
          onLogout={onLogout}
          onClose={() => setOpen(false)}
          userLabel={userLabel}
          userRole={userRole}
        />
      )}
    </div>
  );
}

function ProfileMenu({
  collapsed,
  onLogout,
  onClose,
}: {
  collapsed?: boolean;
  onLogout: () => void;
  onClose: () => void;
  userLabel: string;
  userRole: string;
}) {
  const t = useTranslations('admin.adminSidebar');
  return (
    <div
      className={`absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg ${
        collapsed ? 'left-12 right-auto w-44' : ''
      }`}
      data-profile-menu
    >
      <Link
        href="/"
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]"
      >
        <Globe size={14} aria-hidden />
        {t('toSite')}
      </Link>
      <Link
        href="/admin/setup-2fa"
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        {t('setup2fa')}
      </Link>
      <div className="border-t border-[var(--color-border)] px-3 py-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
          {t('theme')}
        </p>
        <ThemeToggle />
      </div>
      <button
        onClick={() => {
          onClose();
          onLogout();
        }}
        className="flex w-full items-center gap-2 border-t border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-red-50"
      >
        <LogOut size={14} aria-hidden />
        {t('logout')}
      </button>
    </div>
  );
}
