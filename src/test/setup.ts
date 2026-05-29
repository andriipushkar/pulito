import React from 'react';
import { vi, beforeEach } from 'vitest';

// Env defaults must be set BEFORE any module imports happen so that config/env.ts
// (imported transitively by many services) validates against them. `process.env`
// mutations here run at setup time, which is before the test file's own imports.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6380/0',
  JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  APP_URL: 'http://localhost:3000',
  APP_SECRET: 'test-app-secret-minimum-32-chars!!',
};
for (const [k, v] of Object.entries(TEST_ENV)) {
  if (!process.env[k]) process.env[k] = v;
}

// Re-stub before every test so individual tests can override without persisting.
beforeEach(() => {
  for (const [k, v] of Object.entries(TEST_ENV)) {
    vi.stubEnv(k, v);
  }
});

// Global mock for next/image — render a plain <img> in tests so existing
// `container.querySelector('img[src="/foo.jpg"]')` assertions keep working
// regardless of Next.js 16 Image component internals.
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => React.createElement('img', props),
}));

// next/link — plain <a> so href-based assertions match.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) =>
    React.createElement('a', { href, ...rest }, children),
}));

// next/navigation — the node test env can't resolve this Next-internal module,
// and components reach it (directly or via @/i18n/navigation). Stub the hooks
// so client components mount without a real router.
const routerStub = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
});
vi.mock('next/navigation', () => ({
  useRouter: routerStub,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Localized navigation wrapper (built on next-intl/navigation, which loads
// next/navigation at import). Replace it directly: Link → <a>, hooks stubbed.
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) =>
    React.createElement('a', { href, ...rest }, children),
  redirect: vi.fn(),
  usePathname: () => '/',
  useRouter: routerStub,
}));

// next-intl — passthrough translator (returns the key) so client components
// using useTranslations render without a NextIntlClientProvider wrapper. Tests
// that assert real translated copy mock next-intl locally, overriding this.
vi.mock('next-intl', () => {
  const t = ((key: string) => key) as ((key: string) => string) & Record<string, unknown>;
  t.rich = (key: string) => key;
  t.markup = (key: string) => key;
  t.raw = (key: string) => key;
  t.has = () => true;
  return {
    useTranslations: () => t,
    useLocale: () => 'uk',
    useFormatter: () => ({
      number: (n: unknown) => String(n),
      dateTime: (d: unknown) => String(d),
      relativeTime: (d: unknown) => String(d),
    }),
    useNow: () => new Date(),
    useTimeZone: () => 'Europe/Kyiv',
    useMessages: () => ({}),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
