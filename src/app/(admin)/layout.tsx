'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import {
  useState,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from 'react';
import { Menu, Close } from '@/components/icons';
import { useAdminHotkeys } from '@/hooks/useAdminHotkeys';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import AdminErrorBoundary from '@/components/admin/ErrorBoundary';
import AdminSidebar from '@/components/admin/AdminSidebar';
import CommandPalette from '@/components/admin/CommandPalette';
import HelpPanel from '@/components/admin/HelpPanel';
import SessionTimeoutBanner from '@/components/admin/SessionTimeoutBanner';
import MarketplaceHealthAlert from '@/components/admin/MarketplaceHealthAlert';
import ShortcutsModal from '@/components/admin/ShortcutsModal';
import { useAdminShortcuts } from '@/hooks/useAdminShortcuts';
import { PATH_LABELS } from './_lib/admin-pages';

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

// localStorage-backed store consumed via useSyncExternalStore so the value is
// read during render without an unconditional setState inside an effect.
type SidebarListener = () => void;
const sidebarListeners = new Set<SidebarListener>();
const subscribeSidebar = (cb: SidebarListener) => {
  sidebarListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SIDEBAR_COLLAPSED_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    sidebarListeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
};
const getSidebarSnapshot = () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
const getSidebarServerSnapshot = () => false;
const notifySidebar = () => {
  for (const cb of sidebarListeners) cb();
};

// Routes that require 2FA for admins. We block access at the layout level
// rather than at each API to give the admin a clear path to enabling 2FA.
// Managers are exempted so the shop owner can keep day-to-day staff working
// without forcing a security-tooling change on them mid-shift.
const TWO_FA_REQUIRED_PREFIXES = [
  '/admin/payment-settings',
  '/admin/smtp-settings',
  '/admin/settings',
  '/admin/users',
  '/admin/audit-log',
  '/admin/feature-flags',
  '/admin/tenants',
  '/admin/billing',
  '/admin/domains',
  // Added 2026-05-25 — extended coverage to API/integration surfaces where
  // a compromised admin account would do the most damage (issue refunds,
  // exfiltrate API keys, change webhook URLs, push to marketplaces).
  '/admin/integrations',
  '/admin/webhooks',
  '/admin/channel-settings',
  '/admin/channels',
  '/admin/marketplaces',
  '/admin/bot-settings',
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useAdminShortcuts({ onOpenShortcuts: () => setShortcutsOpen(true) });
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const setSidebarCollapsed = useCallback((next: boolean) => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    notifySidebar();
  }, []);
  const { showHelp, setShowHelp, shortcuts } = useAdminHotkeys();
  const { notifications, connected, dismiss, dismissAll } = useAdminNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Load maintenance mode state
  useEffect(() => {
    apiClient.get<{ enabled: boolean }>('/api/v1/admin/maintenance').then((res) => {
      if (res.success && res.data) setMaintenanceMode(res.data.enabled);
    });
  }, []);

  // Swap PWA manifest while the operator is inside /admin. When they install
  // from here, the desktop shortcut opens straight on /admin instead of the
  // public shop, and uses the admin-specific name + theme.
  useEffect(() => {
    const existing = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const previousHref = existing?.getAttribute('href') ?? null;
    if (existing) {
      existing.href = '/admin/manifest.webmanifest';
    } else {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/admin/manifest.webmanifest';
      document.head.appendChild(link);
    }
    return () => {
      const cur = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (cur && previousHref) cur.href = previousHref;
    };
  }, []);

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    const newState = !maintenanceMode;
    const res = await apiClient.put('/api/v1/admin/maintenance', { enabled: newState });
    if (res.success) {
      setMaintenanceMode(newState);
      toast.success(newState ? 'Режим обслуговування увімкнено' : 'Сайт знову працює');
    } else {
      toast.error('Помилка');
    }
    setMaintenanceLoading(false);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Build breadcrumbs from pathname
  const breadcrumbs = useMemo(() => {
    if (!pathname || pathname === '/admin') return [];
    const segments = pathname.split('/').filter(Boolean);
    const crumbs: { label: string; href?: string }[] = [];
    let currentPath = '';
    for (const segment of segments) {
      currentPath += `/${segment}`;
      const label = PATH_LABELS[currentPath];
      if (label) {
        crumbs.push({ label, href: currentPath });
      } else if (/^\d+$/.test(segment)) {
        // Numeric ID - show as detail page
        crumbs.push({ label: `#${segment}` });
      }
    }
    // Last item has no link
    if (crumbs.length > 0) {
      crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label };
    }
    return crumbs;
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg)] p-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
            <svg
              className="h-8 w-8 text-[var(--color-primary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold">Адмін-панель</h1>
          <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
            {user ? (
              <>
                Ви увійшли як{' '}
                <span className="font-medium text-[var(--color-text)]">{user.email}</span> (роль:{' '}
                {user.role}). Для доступу потрібна роль <span className="font-medium">admin</span>{' '}
                або <span className="font-medium">manager</span>.
              </>
            ) : (
              'Увійдіть в свій обліковий запис адміністратора для доступу до панелі управління.'
            )}
          </p>
          <Link
            href="/auth/login?returnUrl=/admin"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-md active:scale-[0.98]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Увійти
          </Link>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]"
          >
            ← Повернутися на сайт
          </Link>
        </div>
      </div>
    );
  }

  // 2FA warning banner (shown but not blocking). Admin can dismiss it
  // ("remind tomorrow") via localStorage — value is the next show-after ISO
  // timestamp. We re-check on each render so a stale snooze auto-expires.
  const TWOFA_SNOOZE_KEY = 'admin-2fa-snooze-until';
  const show2faBanner = (() => {
    if (user.twoFactorEnabled || pathname === '/admin/setup-2fa') return false;
    if (typeof window === 'undefined') return true;
    try {
      const until = window.localStorage.getItem(TWOFA_SNOOZE_KEY);
      if (!until) return true;
      return Date.now() > Number(until);
    } catch {
      return true;
    }
  })();
  const snooze2fa = (hours: number) => {
    try {
      window.localStorage.setItem(TWOFA_SNOOZE_KEY, String(Date.now() + hours * 3600_000));
      // Force re-render by changing a state on the next tick — easier to just
      // navigate to same page programmatically; cheapest: reload.
      router.refresh();
    } catch {
      // ignore
    }
  };

  // 2FA hard-block: admin role hitting a critical route without 2FA. We send
  // them to the setup page instead of the requested route.
  const requires2fa =
    user.role === 'admin' &&
    !user.twoFactorEnabled &&
    pathname !== '/admin/setup-2fa' &&
    TWO_FA_REQUIRED_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-60';

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const isPlatformAdmin = user.role === 'admin';

  const sidebarForMobile = (
    <AdminSidebar
      collapsed={false}
      onToggleCollapse={toggleSidebarCollapse}
      onCloseMobile={() => setSidebarOpen(false)}
      onNavigate={() => setSidebarOpen(false)}
      userLabel={user.fullName || user.email}
      userRole={user.role}
      onLogout={handleLogout}
      isPlatformAdmin={isPlatformAdmin}
    />
  );

  const sidebarForDesktop = (
    <AdminSidebar
      collapsed={sidebarCollapsed}
      onToggleCollapse={toggleSidebarCollapse}
      userLabel={user.fullName || user.email}
      userRole={user.role}
      onLogout={handleLogout}
      isPlatformAdmin={isPlatformAdmin}
    />
  );

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[var(--color-bg-secondary)]">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius)] focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Перейти до контенту
      </a>

      {/* Sidebar (desktop) */}
      <aside
        className={`hidden ${sidebarWidth} shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-all duration-200 lg:block`}
        aria-label="Навігація адмін-панелі"
      >
        {sidebarForDesktop}
      </aside>

      {/* Sidebar (mobile overlay) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Навігаційне меню"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative z-10 h-full w-60 bg-[var(--color-bg)]"
            aria-label="Навігація адмін-панелі"
          >
            {sidebarForMobile}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header
          className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-6"
          role="banner"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 lg:hidden"
            aria-label="Відкрити меню"
          >
            <Menu size={22} />
          </button>

          {/* Breadcrumbs — hidden on very small screens, truncated on mobile */}
          {breadcrumbs.length > 0 ? (
            <nav
              aria-label="Breadcrumbs"
              className="hidden min-w-0 items-center gap-1 text-sm sm:flex"
            >
              <Link
                href="/admin"
                className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
              >
                Dashboard
              </Link>
              {breadcrumbs
                .filter((c) => c.label !== 'Dashboard')
                .map((crumb, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {crumb.href && i < arr.length - 1 ? (
                      <Link
                        href={crumb.href}
                        className="truncate text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-[var(--color-text)]">
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ))}
            </nav>
          ) : (
            <h1 className="text-base font-semibold sm:text-lg">Dashboard</h1>
          )}

          {/* Mobile: show current page title */}
          {breadcrumbs.length > 0 && (
            <span className="truncate text-sm font-semibold sm:hidden">
              {breadcrumbs[breadcrumbs.length - 1].label}
            </span>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            {/* Maintenance mode toggle */}
            <button
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
              className={`hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all lg:flex ${
                maintenanceMode
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]'
              }`}
              title={
                maintenanceMode
                  ? 'Сайт на обслуговуванні — натисніть щоб увімкнути'
                  : 'Увімкнути режим обслуговування'
              }
            >
              {maintenanceMode ? (
                <>
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
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  Обслуговування
                </>
              ) : (
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
                    d="M11.42 15.17l-5.1-5.1m0 0L12 4.37m-5.68 5.7h11.8M4.37 12a7.63 7.63 0 1015.26 0 7.63 7.63 0 00-15.26 0z"
                  />
                </svg>
              )}
            </button>

            {/* Command palette trigger */}
            <button
              onClick={() => {
                // Dispatch Ctrl+K to open command palette
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
              className="hidden items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-text)] lg:flex"
              title="Швидкий перехід (Ctrl+K)"
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
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <span>Перейти до...</span>
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 font-mono text-[10px]">
                Ctrl+K
              </kbd>
            </button>

            {/* Ask AI — quick access from topbar (formerly in sidebar) */}
            <Link
              href="/admin/ask"
              className="hidden items-center gap-1.5 rounded-[var(--radius)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md lg:flex"
              title="Запитати AI"
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
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
              <span>AI</span>
            </Link>

            {/* Help panel */}
            <HelpPanel />

            {/* Notifications bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative rounded-[var(--radius)] p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
                aria-label={connected ? 'Сповіщення (live)' : 'Сповіщення (offline)'}
                title={connected ? 'Live підключення активне' : 'Live підключення розірвано'}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifications.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[9px] font-bold text-white">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
                {notifications.length === 0 && (
                  <span
                    className={`absolute -right-0.5 -top-0.5 inline-block h-2 w-2 rounded-full ${
                      connected ? 'animate-pulse bg-green-500' : 'bg-gray-400'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg sm:w-96">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">Сповіщення</p>
                      {notifications.length > 0 && (
                        <p className="text-[10px] text-[var(--color-text-secondary)]">
                          {notifications.length} непрочитан{notifications.length === 1 ? 'е' : 'их'}
                        </p>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={dismissAll}
                        className="rounded-md bg-[var(--color-bg)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
                      >
                        Прочитати все
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-3 py-8 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
                          <svg
                            className="h-5 w-5 text-[var(--color-text-secondary)]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                            />
                          </svg>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Немає нових сповіщень
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const groups: Record<string, typeof notifications> = {};
                        for (const n of notifications) {
                          const key = n.type === 'new_order' ? 'Замовлення' : 'Інше';
                          (groups[key] ||= []).push(n);
                        }
                        return Object.entries(groups).map(([groupName, items]) => (
                          <div key={groupName}>
                            <p className="border-b border-[var(--color-border)]/40 bg-[var(--color-bg-secondary)]/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                              {groupName} • {items.length}
                            </p>
                            {items.map((n) => (
                              <div
                                key={n.id}
                                className="group flex items-start gap-2 border-b border-[var(--color-border)]/40 px-3 py-2 last:border-0 hover:bg-[var(--color-bg-secondary)]"
                              >
                                <span className="mt-0.5 text-sm">
                                  {n.type === 'new_order' ? '📦' : '💬'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs leading-snug">{n.message}</p>
                                  <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                                    {new Date(n.timestamp).toLocaleTimeString('uk-UA', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => dismiss(n.id)}
                                  className="rounded p-0.5 text-[var(--color-text-secondary)] opacity-0 transition-opacity hover:bg-[var(--color-border)] hover:text-[var(--color-text)] group-hover:opacity-100"
                                  aria-label="Прочитано"
                                  title="Прочитано"
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
                                      d="M4.5 12.75l6 6 9-13.5"
                                    />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowHelp(true)}
              className="hidden text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] lg:block"
              title="Гарячі клавіші"
            >
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-[10px]">
                /
              </kbd>
            </button>
          </div>
        </header>

        <main id="admin-main-content" className="flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <SessionTimeoutBanner />
          {show2faBanner && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <svg
                className="h-4 w-4 shrink-0 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <p className="flex-1 text-xs font-medium text-amber-900">
                Увімкніть двофакторну автентифікацію для захисту акаунту
              </p>
              <Link
                href="/admin/setup-2fa"
                className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
              >
                Увімкнути
              </Link>
              <button
                type="button"
                onClick={() => snooze2fa(24)}
                className="shrink-0 text-[11px] font-medium text-amber-700 hover:underline"
                title="Нагадати завтра"
              >
                Нагадати завтра
              </button>
              <button
                type="button"
                onClick={() => snooze2fa(24 * 30)}
                className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
                aria-label="Сховати на місяць"
                title="Сховати на місяць"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {requires2fa ? (
            <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-7 w-7 text-red-600"
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
              </div>
              <h2 className="mb-2 text-xl font-bold text-red-800">
                Цей розділ потребує двофакторної автентифікації
              </h2>
              <p className="mb-6 text-sm text-red-700">
                Для доступу до критичних налаштувань (платежі, користувачі, журнал дій, загальні
                налаштування) адміністратор повинен увімкнути 2FA. Це захищає акаунт від
                несанкціонованого доступу навіть при компрометації пароля.
              </p>
              <Link
                href="/admin/setup-2fa"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Увімкнути 2FA зараз
              </Link>
              <p className="mt-4 text-xs text-red-600">
                Зайде хвилина — додайте додаток-аутентифікатор (Google Authenticator, 1Password) і
                ви знову матимете повний доступ.
              </p>
            </div>
          ) : (
            <>
              <MarketplaceHealthAlert />
              <AdminErrorBoundary>{children}</AdminErrorBoundary>
            </>
          )}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Keyboard shortcuts help modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Гарячі клавіші"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowHelp(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Гарячі клавіші</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                aria-label="Закрити"
              >
                <Close size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {shortcuts.map((s) => (
                <div
                  key={s.key + (s.ctrl ? 'c' : '') + (s.shift ? 's' : '')}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{s.description}</span>
                  <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-mono">
                    {s.ctrl ? 'Ctrl+' : ''}
                    {s.shift ? 'Shift+' : ''}
                    {s.key.toUpperCase()}
                  </kbd>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm">
                <span>Швидкий перехід</span>
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-mono">
                  Ctrl+K
                </kbd>
              </div>
            </div>
            <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
              Натисніть Esc для закриття
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
