'use client';

import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/account/PageHeader';

export default function PricelistPage() {
  const { user } = useAuth();

  const canDownloadWholesale =
    user?.role === 'wholesaler' || user?.role === 'manager' || user?.role === 'admin';

  return (
    <div>
      <PageHeader
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        }
        title="Прайс-листи"
        subtitle="Завантажте актуальний прайс-лист у форматі PDF"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Retail pricelist */}
        <a
          href="/api/v1/pricelist?type=retail"
          download
          className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6 transition-all"
        >
          <div className="relative flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </div>
            <div>
              <span className="text-base font-bold text-[var(--color-text)]">Роздрібний прайс-лист</span>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Завантажити PDF</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              PDF
            </span>
          </div>
        </a>

        {/* Wholesale pricelist */}
        {canDownloadWholesale ? (
          <a
            href="/api/v1/pricelist?type=wholesale"
            download
            className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6 transition-all"
          >
            <div className="relative flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              </div>
              <div>
                <span className="text-base font-bold text-[var(--color-text)]">Оптовий прайс-лист</span>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Завантажити PDF</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                PDF
              </span>
            </div>
          </a>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6 opacity-60">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <div>
                <span className="text-base font-bold text-[var(--color-text-secondary)]">Оптовий прайс-лист</span>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Доступний для оптових клієнтів
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                Заблоковано
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
