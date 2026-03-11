import { describe, it, expect, vi } from 'vitest';

vi.mock('next-intl/navigation', () => ({
  createNavigation: vi.fn().mockReturnValue({
    Link: 'MockLink',
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
  }),
}));

vi.mock('./routing', () => ({
  routing: { locales: ['uk', 'en'], defaultLocale: 'uk' },
}));

import { Link, redirect, usePathname, useRouter } from './navigation';

describe('i18n/navigation', () => {
  it('exports Link, redirect, usePathname, useRouter', () => {
    expect(Link).toBeDefined();
    expect(redirect).toBeDefined();
    expect(usePathname).toBeDefined();
    expect(useRouter).toBeDefined();
  });
});
