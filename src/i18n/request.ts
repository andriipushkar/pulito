import { getRequestConfig } from 'next-intl/server';
import { routing, type Locale } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Cast through `string` first: when routing.locales narrows to a single
  // tuple element, includes() rejects any other literal at compile time —
  // the runtime check still needs to run for unknown values from the URL.
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale: locale as Locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
