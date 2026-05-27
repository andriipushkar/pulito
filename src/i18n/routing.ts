import { defineRouting } from 'next-intl/routing';

// Site is uk-only. EN/PL/RO infrastructure stays in place (messages, DB
// columns, admin EN tabs) so re-enabling later is a one-line change:
// add the locale code back into the array below and ship.
export const routing = defineRouting({
  locales: ['uk'],
  defaultLocale: 'uk',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
