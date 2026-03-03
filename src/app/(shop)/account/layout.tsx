'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const COMMON_NAV: NavItem[] = [
  { href: '/account', label: 'Головна', exact: true },
  { href: '/account/orders', label: 'Замовлення' },
  { href: '/account/wishlist', label: 'Обране' },
  { href: '/account/notifications', label: 'Сповіщення' },
];

const RETAIL_NAV: NavItem[] = [
  ...COMMON_NAV,
  { href: '/account/pricelist', label: 'Прайс-листи' },
  { href: '/account/addresses', label: 'Адреси' },
  { href: '/account/referral', label: 'Реферальна програма' },
  { href: '/account/loyalty', label: 'Бонусна програма' },
  { href: '/account/settings', label: 'Налаштування' },
  { href: '/pages/wholesale', label: 'Стати оптовиком' },
];

const WHOLESALE_NAV: NavItem[] = [
  ...COMMON_NAV,
  { href: '/account/quick-order', label: 'Швидке замовлення' },
  { href: '/account/pricelist', label: 'Прайс-листи' },
  { href: '/account/finance', label: 'Фінанси' },
  { href: '/account/notes', label: 'Нотатки' },
  { href: '/account/manager', label: 'Менеджер' },
  { href: '/account/status', label: 'Мої умови' },
  { href: '/account/addresses', label: 'Адреси' },
  { href: '/account/referral', label: 'Реферальна програма' },
  { href: '/account/loyalty', label: 'Бонусна програма' },
  { href: '/account/settings', label: 'Налаштування' },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  const navItems = user.role === 'wholesaler' ? WHOLESALE_NAV : RETAIL_NAV;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Особистий кабінет</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{user.email}</p>
      </div>

      <div className="gap-8 lg:grid lg:grid-cols-[220px_1fr]">
        <nav className="mb-6 lg:mb-0">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${
                    (item.exact ? pathname === item.href : pathname?.startsWith(item.href))
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 hidden border-t border-[var(--color-border)] pt-2 lg:block">
              <button
                onClick={() => { logout(); router.push('/'); }}
                className="block w-full rounded-[var(--radius)] px-4 py-2 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
              >
                Вийти
              </button>
            </li>
          </ul>
          {/* Mobile logout */}
          <button
            onClick={() => { logout(); router.push('/'); }}
            className="mt-2 rounded-[var(--radius)] px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 lg:hidden"
          >
            Вийти з акаунту
          </button>
        </nav>

        <main>{children}</main>
      </div>
    </div>
  );
}
