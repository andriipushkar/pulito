'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Close } from '@/components/icons';

// Maps a route to its help-section slug in the admin.helpPanel.pages namespace.
// The matcher below resolves a pathname to the longest matching key.
const HELP_SLUGS: Record<string, string> = {
  '/admin': 'dashboard',
  '/admin/orders': 'orders',
  '/admin/products': 'products',
  '/admin/users': 'users',
  '/admin/analytics': 'analytics',
  '/admin/reports': 'reports',
  '/admin/categories': 'categories',
  '/admin/pages': 'pages',
  '/admin/faq': 'faq',
  '/admin/import': 'import',
  '/admin/publications': 'publications',
  '/admin/badges': 'badges',
  '/admin/personal-prices': 'personalPrices',
  '/admin/wholesale-rules': 'wholesaleRules',
  '/admin/referrals': 'referrals',
  '/admin/loyalty': 'loyalty',
  '/admin/email-templates': 'emailTemplates',
  '/admin/feedback': 'feedback',
  '/admin/channels': 'channels',
  '/admin/channel-settings': 'channelSettings',
  '/admin/bot-settings': 'botSettings',
  '/admin/moderation': 'moderation',
  '/admin/marketplaces': 'marketplaces',
  '/admin/settings': 'settings',
  '/admin/payment-settings': 'paymentSettings',
  '/admin/delivery-settings': 'deliverySettings',
  '/admin/smtp-settings': 'smtpSettings',
  '/admin/homepage': 'homepage',
  '/admin/banners': 'banners',
  '/admin/themes': 'themes',
  '/admin/seo-templates': 'seoTemplates',
  '/admin/seo-audit': 'seoAudit',
  '/admin/pallet-delivery': 'palletDelivery',
  '/admin/audit-log': 'auditLog',
  // ── Detail pages ──
  '/admin/orders/': 'ordersDetail',
  '/admin/products/': 'productsDetail',
  '/admin/users/': 'usersDetail',
};

export default function HelpPanel() {
  const t = useTranslations('admin.helpPanel');
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Find help for current page (exact match or parent match). Compare on
  // segment boundaries so `/admin/orders` doesn't accidentally also match
  // `/admin/orders-archive` etc.
  const helpKey =
    pathname && HELP_SLUGS[pathname]
      ? pathname
      : pathname
        ? Object.keys(HELP_SLUGS)
            .filter(
              (k) =>
                k !== '/admin' &&
                (pathname === k || pathname.startsWith(k.endsWith('/') ? k : `${k}/`)),
            )
            .sort((a, b) => b.length - a.length)[0] || '/admin'
        : '/admin';

  const slug = HELP_SLUGS[helpKey];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
      if (e.key === 'F1') {
        e.preventDefault();
        setIsOpen((p) => !p);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!slug) return null;

  const title = t(`pages.${slug}.title`);
  const description = t(`pages.${slug}.description`);
  const steps = t.has(`pages.${slug}.steps`)
    ? (t.raw(`pages.${slug}.steps`) as string[])
    : undefined;
  const tips = t.has(`pages.${slug}.tips`) ? (t.raw(`pages.${slug}.tips`) as string[]) : undefined;

  return (
    <>
      {/* Help trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-sm font-bold text-[var(--color-primary)] shadow-sm transition-all hover:bg-[var(--color-primary)] hover:text-white"
        title={t('ui.helpTitleBtn')}
      >
        ?
      </button>

      {/* Slide-out panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal="true"
          aria-label={t('ui.help')}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto bg-[var(--color-bg)] shadow-2xl sm:max-w-md">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
                  <svg
                    className="h-5 w-5 text-[var(--color-primary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-bold">{t('ui.help')}</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                aria-label={t('ui.close')}
              >
                <Close size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Title & Description */}
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text)]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {description}
                </p>
              </div>

              {/* Steps */}
              {steps && steps.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {t('ui.howToUse')}
                  </h4>
                  <ol className="space-y-2.5">
                    {steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 text-[var(--color-text)]">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Tips */}
              {tips && tips.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                      />
                    </svg>
                    {t('ui.tips')}
                  </h4>
                  <ul className="space-y-2">
                    {tips.map((tip, i) => (
                      <li
                        key={i}
                        className="flex gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
                      >
                        <span className="shrink-0">💡</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Keyboard shortcuts hint */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
                <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                  {t('ui.shortcuts')}
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">{t('ui.openHelp')}</span>
                    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-xs font-mono">
                      F1
                    </kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">{t('ui.quickNav')}</span>
                    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-xs font-mono">
                      Ctrl+K
                    </kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">{t('ui.close')}</span>
                    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-xs font-mono">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
