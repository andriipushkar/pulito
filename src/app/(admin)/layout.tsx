'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import { useState, type ReactNode } from 'react';
import { Menu, Close } from '@/components/icons';
import AuthProvider from '@/providers/AuthProvider';
import { useAdminHotkeys } from '@/hooks/useAdminHotkeys';

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
      { href: '/admin/bot-settings', label: 'Налаштування ботів', icon: '🤖' },
      { href: '/admin/moderation', label: 'Модерація', icon: '🛡️' },
    ],
  },
  {
    title: 'Налаштування',
    items: [
      { href: '/admin/settings', label: 'Загальні', icon: '⚙️' },
      { href: '/admin/homepage', label: 'Головна сторінка', icon: '🏠' },
      { href: '/admin/banners', label: 'Банери', icon: '🖼️' },
      { href: '/admin/themes', label: 'Теми', icon: '🎨' },
      { href: '/admin/seo-templates', label: 'SEO-шаблони', icon: '🔍' },
      { href: '/admin/seo-audit', label: 'SEO-аудит', icon: '🔗' },
      { href: '/admin/pallet-delivery', label: 'Палетна доставка', icon: '🚚' },
      { href: '/admin/audit-log', label: 'Журнал дій', icon: '📋' },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AuthProvider>
  );
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showHelp, setShowHelp, shortcuts } = useAdminHotkeys();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Доступ до адмін-панелі</h1>
        <p className="text-[var(--color-text-secondary)]">
          {user ? `Ви увійшли як ${user.email} (роль: ${user.role}). Потрібна роль admin або manager.` : 'Ви не авторизовані.'}
        </p>
        <a href="/auth/login" className="rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-2.5 font-medium text-white">
          Увійти як адмін
        </a>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname?.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
        <Link href="/admin" className="text-lg font-bold text-[var(--color-primary)]">
          Clean Admin
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden"
          aria-label="Закрити меню"
        >
          <Close size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Головне меню">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-4">
            {section.title && (
              <p className="mb-1 px-3 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
                      isActive(item.href, (item as { exact?: boolean }).exact)
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
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
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-secondary)]">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius)] focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Перейти до контенту
      </a>

      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg)] lg:block" aria-label="Навігація адмін-панелі">
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
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 lg:px-6" role="banner">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
            aria-label="Відкрити меню"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold">Панель управління</h1>
          <button
            onClick={() => setShowHelp(true)}
            className="ml-auto hidden text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] lg:block"
            title="Гарячі клавіші"
          >
            Натисніть <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-[10px]">/</kbd> для гарячих клавіш
          </button>
        </header>

        <main id="admin-main-content" className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

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
            </div>
            <p className="mt-4 text-xs text-[var(--color-text-secondary)]">Натисніть Esc для закриття</p>
          </div>
        </div>
      )}
    </div>
  );
}
