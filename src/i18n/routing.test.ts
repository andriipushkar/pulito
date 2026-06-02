import { describe, it, expect, vi } from 'vitest';

vi.mock('next-intl/routing', () => ({
  defineRouting: vi.fn((config: unknown) => config),
}));

import { routing } from './routing';

describe('i18n/routing', () => {
  it('exports routing config with locales and defaultLocale', () => {
    expect(routing).toHaveProperty('locales');
    expect(routing).toHaveProperty('defaultLocale', 'uk');
    // Site is uk-only by design (EN/PL/RO infra stays but is not routed).
    expect((routing as unknown as { locales: string[] }).locales).toEqual(['uk']);
  });

  it('uses as-needed locale prefix', () => {
    expect(routing).toHaveProperty('localePrefix', 'as-needed');
  });
});
