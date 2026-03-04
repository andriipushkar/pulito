'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  section?: string;
}

/* ── SVG Icons ── */
const IconHome = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);
const IconOrders = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);
const IconHeart = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);
const IconBell = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);
const IconDocument = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);
const IconMapPin = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);
const IconUsers = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const IconGift = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>
);
const IconSettings = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconRocket = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-6.233 0c-1.045 1.045-1.555 4.139-1.638 5.724a.258.258 0 00.289.288c1.585-.083 4.679-.593 5.724-1.638a4.493 4.493 0 00.06-6.217l-.06-.063z" />
  </svg>
);
const IconBolt = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);
const IconChart = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const IconNote = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);
const IconUserCircle = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconShield = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
const IconLogout = () => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);
const IconMenu = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);
const IconClose = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const MAIN_NAV: NavItem[] = [
  { href: '/account', label: 'Головна', icon: <IconHome />, exact: true, section: 'Основне' },
  { href: '/account/orders', label: 'Замовлення', icon: <IconOrders />, section: 'Основне' },
  { href: '/account/wishlist', label: 'Обране', icon: <IconHeart />, section: 'Основне' },
  { href: '/account/notifications', label: 'Сповіщення', icon: <IconBell />, section: 'Основне' },
];

const RETAIL_SERVICES: NavItem[] = [
  { href: '/account/pricelist', label: 'Прайс-листи', icon: <IconDocument />, section: 'Сервіси' },
  { href: '/account/addresses', label: 'Адреси', icon: <IconMapPin />, section: 'Сервіси' },
  { href: '/account/referral', label: 'Реферальна програма', icon: <IconUsers />, section: 'Сервіси' },
  { href: '/account/loyalty', label: 'Бонусна програма', icon: <IconGift />, section: 'Сервіси' },
  { href: '/account/settings', label: 'Налаштування', icon: <IconSettings />, section: 'Сервіси' },
  { href: '/account/wholesale-request', label: 'Стати оптовиком', icon: <IconRocket />, section: 'Сервіси' },
];

const WHOLESALE_SERVICES: NavItem[] = [
  { href: '/account/quick-order', label: 'Швидке замовлення', icon: <IconBolt />, section: 'Сервіси' },
  { href: '/account/pricelist', label: 'Прайс-листи', icon: <IconDocument />, section: 'Сервіси' },
  { href: '/account/finance', label: 'Фінанси', icon: <IconChart />, section: 'Сервіси' },
  { href: '/account/notes', label: 'Нотатки', icon: <IconNote />, section: 'Сервіси' },
  { href: '/account/manager', label: 'Менеджер', icon: <IconUserCircle />, section: 'Сервіси' },
  { href: '/account/status', label: 'Мої умови', icon: <IconShield />, section: 'Сервіси' },
  { href: '/account/addresses', label: 'Адреси', icon: <IconMapPin />, section: 'Сервіси' },
  { href: '/account/referral', label: 'Реферальна програма', icon: <IconUsers />, section: 'Сервіси' },
  { href: '/account/loyalty', label: 'Бонусна програма', icon: <IconGift />, section: 'Сервіси' },
  { href: '/account/settings', label: 'Налаштування', icon: <IconSettings />, section: 'Сервіси' },
];

function NavSection({ label, items, isActive }: { label: string; items: NavItem[]; isActive: (item: NavItem) => boolean }) {
  return (
    <div>
      <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? 'border-l-2 border-[var(--color-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text)] pl-[10px]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/50 hover:text-[var(--color-text)]'
                }`}
              >
                <span className={active ? 'text-[var(--color-primary)]' : ''}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (!user) {
    router.push('/auth/login');
    return null;
  }

  const serviceItems = user.role === 'wholesaler' ? WHOLESALE_SERVICES : RETAIL_SERVICES;

  const isActiveItem = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href);

  const initials = user.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || '?';

  const sidebarContent = (
    <>
      {/* User info */}
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-text)]">{user.fullName || 'Користувач'}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{user.email}</p>
        </div>
      </div>

      {user.role === 'wholesaler' && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)]/5 px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)]">
          <IconShield />
          <span>Оптовий клієнт</span>
        </div>
      )}

      <div className="my-2 border-t border-[var(--color-border)]/60" />

      {/* Nav sections */}
      <div className="space-y-4 px-1">
        <NavSection label="Основне" items={MAIN_NAV} isActive={isActiveItem} />
        <NavSection label="Сервіси" items={serviceItems} isActive={isActiveItem} />
      </div>

      <div className="my-2 border-t border-[var(--color-border)]/60" />

      {/* Logout */}
      <div className="px-1">
        <button
          onClick={() => { logout(); router.push('/'); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50"
        >
          <IconLogout />
          <span>Вийти</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="gap-6 lg:grid lg:grid-cols-[260px_1fr] xl:gap-8">
        {/* ── Mobile nav toggle ── */}
        <div className="mb-4 lg:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] shadow-sm"
          >
            <IconMenu />
            <span>Меню акаунту</span>
          </button>
        </div>

        {/* ── Mobile nav overlay ── */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 animate-slide-in-left overflow-y-auto bg-[var(--color-bg)] p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Акаунт</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <IconClose />
                </button>
              </div>
              <div onClick={() => setMobileNavOpen(false)}>
                {sidebarContent}
              </div>
            </div>
          </div>
        )}

        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] py-2 shadow-sm">
            {sidebarContent}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
