'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const LOCALE_LABELS: Record<string, string> = {
  uk: 'UK',
  en: 'EN',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // Hide the switcher entirely on single-locale builds — saves a useless
  // "UK / UK" button in the TopBar. Re-appears automatically when a second
  // locale is added to routing.locales.
  if (routing.locales.length <= 1) return null;

  const otherLocale = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  const handleSwitch = () => {
    router.replace(pathname, { locale: otherLocale });
  };

  return (
    <button
      onClick={handleSwitch}
      className="rounded px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
      aria-label={`Switch to ${LOCALE_LABELS[otherLocale]}`}
    >
      {LOCALE_LABELS[locale]} / <span className="opacity-60">{LOCALE_LABELS[otherLocale]}</span>
    </button>
  );
}
