import { describe, it, expect, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getRequestConfig: vi.fn((fn: unknown) => fn),
}));

vi.mock('./routing', () => ({
  routing: {
    locales: ['uk', 'en'],
    defaultLocale: 'uk',
  },
}));

vi.mock('../messages/uk.json', () => ({ default: { hello: 'Привіт' } }));
vi.mock('../messages/en.json', () => ({ default: { hello: 'Hello' } }));

import requestConfig from './request';

describe('i18n/request', () => {
  it('returns locale and messages for a valid locale', async () => {
    // requestConfig is the callback passed to getRequestConfig
    const config = await (requestConfig as Function)({ requestLocale: Promise.resolve('uk') });
    expect(config.locale).toBe('uk');
    expect(config.messages).toBeDefined();
  });

  it('falls back to default locale for invalid locale', async () => {
    const config = await (requestConfig as Function)({ requestLocale: Promise.resolve('fr') });
    expect(config.locale).toBe('uk');
  });

  it('falls back to default locale when requestLocale is undefined', async () => {
    const config = await (requestConfig as Function)({ requestLocale: Promise.resolve(undefined) });
    expect(config.locale).toBe('uk');
  });
});
