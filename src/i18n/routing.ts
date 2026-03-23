import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['uk', 'en', 'pl', 'ro'],
  defaultLocale: 'uk',
  localePrefix: 'as-needed',
});
