'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Menu, Close } from '@/components/icons';
import { useAdminHotkeys } from '@/hooks/useAdminHotkeys';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import AdminErrorBoundary from '@/components/admin/ErrorBoundary';
import CommandPalette from '@/components/admin/CommandPalette';
import HelpPanel from '@/components/admin/HelpPanel';

const NAV_SECTIONS = [
  {
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
      { href: '/admin/orders', label: 'Замовлення', icon: '📦' },
      { href: '/admin/users', label: 'Користувачі', icon: '👥' },
      { href: '/admin/analytics', label: 'Аналітика', icon: '📈' },
      { href: '/admin/reports', label: 'Звіти', icon: '📊' },
    ],
  },
  {
    title: 'Контент',
    items: [
      { href: '/admin/products', label: 'Товари', icon: '🛒' },
      { href: '/admin/categories', label: 'Категорії', icon: '📁' },
      { href: '/admin/pages', label: 'Сторінки', icon: '📄' },
      { href: '/admin/faq', label: 'FAQ', icon: '❓' },
      { href: '/admin/import', label: 'Імпорт', icon: '📥' },
      { href: '/admin/publications', label: 'Публікації', icon: '📢' },
      { href: '/admin/badges', label: 'Бейджі', icon: '🏷️' },
      { href: '/admin/personal-prices', label: 'Персональні ціни', icon: '💰' },
      { href: '/admin/wholesale-rules', label: 'Оптові правила', icon: '📦' },
      { href: '/admin/referrals', label: 'Реферали', icon: '🔗' },
      { href: '/admin/loyalty', label: 'Лояльність', icon: '⭐' },
      { href: '/admin/email-templates', label: 'Email-шаблони', icon: '📧' },
      { href: '/admin/feedback', label: 'Зворотний зв\'язок', icon: '💬' },
    ],
  },
  {
    title: 'Канали',
    items: [
      { href: '/admin/channels', label: 'Статистика каналів', icon: '📡' },
      { href: '/admin/channel-settings', label: 'Налаштування каналів', icon: '🔧' },
      { href: '/admin/bot-settings', label: 'Налаштування ботів', icon: '🤖' },
      { href: '/admin/moderation', label: 'Модерація', icon: '🛡️' },
    ],
  },
  {
    title: 'Маркетплейси',
    items: [
      { href: '/admin/marketplaces', label: 'Маркетплейси', icon: '🏪' },
    ],
  },
  {
    title: 'Налаштування',
    items: [
      { href: '/admin/settings', label: 'Загальні', icon: '⚙️' },
      { href: '/admin/payment-settings', label: 'Платіжні системи', icon: '💳' },
      { href: '/admin/delivery-settings', label: 'Служби доставки', icon: '🚚' },
      { href: '/admin/smtp-settings', label: 'Email / SMTP', icon: '📧' },
      { href: '/admin/homepage', label: 'Головна сторінка', icon: '🏠' },
      { href: '/admin/banners', label: 'Банери', icon: '🖼️' },
      { href: '/admin/themes', label: 'Теми', icon: '🎨' },
      { href: '/admin/seo-templates', label: 'SEO-шаблони', icon: '🔍' },
      { href: '/admin/seo-audit', label: 'SEO-аудит', icon: '🔗' },
      { href: '/admin/pallet-delivery', label: 'Палетна доставка', icon: '📦' },
      { href: '/admin/audit-log', label: 'Журнал дій', icon: '📋' },
    ],
  },
];

// Map paths to breadcrumb labels
const PATH_LABELS: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/orders': 'Замовлення',
  '/admin/products': 'Товари',
  '/admin/users': 'Користувачі',
  '/admin/analytics': 'Аналітика',
  '/admin/reports': 'Звіти',
  '/admin/categories': 'Категорії',
  '/admin/pages': 'Сторінки',
  '/admin/faq': 'FAQ',
  '/admin/import': 'Імпорт',
  '/admin/publications': 'Публікації',
  '/admin/badges': 'Бейджі',
  '/admin/personal-prices': 'Персональні ціни',
  '/admin/wholesale-rules': 'Оптові правила',
  '/admin/referrals': 'Реферали',
  '/admin/loyalty': 'Лояльність',
  '/admin/email-templates': 'Email-шаблони',
  '/admin/feedback': 'Зворотний зв\'язок',
  '/admin/channels': 'Статистика каналів',
  '/admin/channel-settings': 'Налаштування каналів',
  '/admin/bot-settings': 'Налаштування ботів',
  '/admin/moderation': 'Модерація',
  '/admin/settings': 'Налаштування',
  '/admin/payment-settings': 'Платіжні системи',
  '/admin/delivery-settings': 'Служби доставки',
  '/admin/smtp-settings': 'Email / SMTP',
  '/admin/marketplaces': 'Маркетплейси',
  '/admin/homepage': 'Головна сторінка',
  '/admin/banners': 'Банери',
  '/admin/themes': 'Теми',
  '/admin/seo-templates': 'SEO-шаблони',
  '/admin/seo-audit': 'SEO-аудит',
  '/admin/pallet-delivery': 'Палетна доставка',
  '/admin/audit-log': 'Журнал дій',
};

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { showHelp, setShowHelp, shortcuts } = useAdminHotkeys();
  const { notifications, dismiss, dismissAll } = useAdminNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Load maintenance mode state
  useEffect(() => {
    apiClient.get<{ enabled: boolean }>('/api/v1/admin/maintenance').then((res) => {
      if (res.success && res.data) setMaintenanceMode(res.data.enabled);
    });
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

  // Restore sidebar collapsed state
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === 'true') setSidebarCollapsed(true);
  }, []);

  const toggleSidebarCollapse = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
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
            <svg className="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold">Адмін-панель</h1>
          <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
            {user
              ? <>Ви увійшли як <span className="font-medium text-[var(--color-text)]">{user.email}</span> (роль: {user.role}). Для доступу потрібна роль <span className="font-medium">admin</span> або <span className="font-medium">manager</span>.</>
              : 'Увійдіть в свій обліковий запис адміністратора для доступу до панелі управління.'
            }
          </p>
          <a
            href="/auth/login?returnUrl=/admin"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-md active:scale-[0.98]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Увійти
          </a>
          <a href="/" className="mt-4 inline-block text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]">
            ← Повернутися на сайт
          </a>
        </div>
      </div>
    );
  }

  // 2FA warning banner (shown but not blocking)
  const show2faBanner = !user.twoFactorEnabled && pathname !== '/admin/setup-2fa';

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname?.startsWith(href);

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-60';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
        {!sidebarCollapsed && (
          <Link href="/admin" className="text-lg font-bold text-[var(--color-primary)]">
            Clean Admin
          </Link>
        )}
        {/* Collapse button (desktop) */}
        <button
          onClick={toggleSidebarCollapse}
          className="hidden rounded-[var(--radius)] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)] lg:block"
          aria-label={sidebarCollapsed ? 'Розгорнути меню' : 'Згорнути меню'}
          title={sidebarCollapsed ? 'Розгорнути' : 'Згорнути'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed ? (
              <><path d="M13 17l5-5-5-5" /><path d="M6 17l5-5-5-5" /></>
            ) : (
              <><path d="M11 17l-5-5 5-5" /><path d="M18 17l-5-5 5-5" /></>
            )}
          </svg>
        </button>
        {/* Close button (mobile) */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden"
          aria-label="Закрити меню"
        >
          <Close size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Головне меню">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-4">
            {section.title && !sidebarCollapsed && (
              <p className="mb-1 px-3 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                {section.title}
              </p>
            )}
            {section.title && sidebarCollapsed && (
              <div className="mx-auto mb-1 h-px w-8 bg-[var(--color-border)]" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
                      sidebarCollapsed ? 'justify-center' : ''
                    } ${
                      isActive(item.href, (item as { exact?: boolean }).exact)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    <span className={sidebarCollapsed ? 'text-lg' : ''}>{item.icon}</span>
                    {!sidebarCollapsed && item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Link href="/" className="text-xs text-[var(--color-primary)]" title="На сайт">🌐</Link>
            <button
              onClick={() => { logout(); router.push('/auth/login'); }}
              className="text-xs text-[var(--color-danger)]"
              title="Вийти"
            >
              🚪
            </button>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-medium">{user.fullName || user.email}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{user.role}</p>
            <div className="mt-2 flex gap-2">
              <Link href="/" className="text-xs text-[var(--color-primary)] hover:underline">
                На сайт
              </Link>
              <button
                onClick={() => { logout(); router.push('/auth/login'); }}
                className="text-xs text-[var(--color-danger)] hover:underline"
              >
                Вийти
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
        className={`hidden ${sidebarWidth} shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-all duration-200 lg:block`}
        aria-label="Навігація адмін-панелі"
      >
        {sidebar}
      </aside>

      {/* Sidebar (mobile overlay) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Навігаційне меню">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-60 bg-[var(--color-bg)]" aria-label="Навігація адмін-панелі">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-6" role="banner">
          <button
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 lg:hidden"
            aria-label="Відкрити меню"
          >
            <Menu size={22} />
          </button>

          {/* Breadcrumbs — hidden on very small screens, truncated on mobile */}
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumbs" className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
              <Link href="/admin" className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
                Dashboard
              </Link>
              {breadcrumbs.filter(c => c.label !== 'Dashboard').map((crumb, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {crumb.href && i < arr.length - 1 ? (
                    <Link href={crumb.href} className="truncate text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-[var(--color-text)]">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : (
            <h1 className="text-base font-semibold sm:text-lg">Панель управління</h1>
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
              title={maintenanceMode ? 'Сайт на обслуговуванні — натисніть щоб увімкнути' : 'Увімкнути режим обслуговування'}
            >
              {maintenanceMode ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Обслуговування
                </>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L12 4.37m-5.68 5.7h11.8M4.37 12a7.63 7.63 0 1015.26 0 7.63 7.63 0 00-15.26 0z" />
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
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span>Перейти до...</span>
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 font-mono text-[10px]">Ctrl+K</kbd>
            </button>

            {/* Help panel */}
            <HelpPanel />

            {/* Notifications bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative rounded-[var(--radius)] p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
                aria-label="Сповіщення"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {notifications.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[9px] font-bold text-white">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg sm:w-80">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
                    <span className="text-sm font-medium">Сповіщення</span>
                    {notifications.length > 0 && (
                      <button onClick={dismissAll} className="text-xs text-[var(--color-text-secondary)] hover:underline">Очистити</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)]">Немає нових сповіщень</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="flex items-start gap-2 border-b border-[var(--color-border)] px-3 py-2 last:border-0 hover:bg-[var(--color-bg-secondary)]">
                          <span className="mt-0.5 text-sm">{n.type === 'new_order' ? '📦' : '💬'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs">{n.message}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">
                              {new Date(n.timestamp).toLocaleTimeString('uk-UA')}
                            </p>
                          </div>
                          <button onClick={() => dismiss(n.id)} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">x</button>
                        </div>
                      ))
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
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-[10px]">/</kbd>
            </button>
          </div>
        </header>

        <main id="admin-main-content" className="flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-6">
          {show2faBanner && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Рекомендуємо увімкнути двофакторну автентифікацію</p>
                <p className="text-xs text-amber-600">2FA захищає ваш акаунт від несанкціонованого доступу</p>
              </div>
              <a href="/admin/setup-2fa" className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
                Увімкнути
              </a>
            </div>
          )}
          <AdminErrorBoundary>
            {children}
          </AdminErrorBoundary>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette />

      {/* Keyboard shortcuts help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Гарячі клавіші">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowHelp(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Гарячі клавіші</h3>
              <button onClick={() => setShowHelp(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" aria-label="Закрити">
                <Close size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {shortcuts.map((s) => (
                <div key={s.key + (s.ctrl ? 'c' : '') + (s.shift ? 's' : '')} className="flex items-center justify-between text-sm">
                  <span>{s.description}</span>
                  <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-mono">
                    {s.ctrl ? 'Ctrl+' : ''}{s.shift ? 'Shift+' : ''}{s.key.toUpperCase()}
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
            <p className="mt-4 text-xs text-[var(--color-text-secondary)]">Натисніть Esc для закриття</p>
          </div>
        </div>
      )}
    </div>
  );
}
