'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  title?: string;
  children: ReactNode;
  preview: ReactNode;
  /**
   * `seoTitle` & `seoDescription` add a Google-result-card mock above the
   * preview, so admins can see how the page will appear in search results.
   */
  seoTitle?: string;
  seoDescription?: string;
  seoSlug?: string;
}

export default function PreviewPanel({
  title,
  children,
  preview,
  seoTitle,
  seoDescription,
  seoSlug,
}: Props) {
  const t = useTranslations('admin.previewPanel');
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
          aria-pressed={showPreview}
        >
          {showPreview ? t('hidePreview') : t('showPreview')}
        </button>
      </div>
      <div className={`grid gap-4 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div>{children}</div>
        {showPreview && (
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border)] pb-2">
              <h3 className="text-sm font-semibold">
                {title ? t('previewTitleWith', { title }) : t('previewTitle')}
              </h3>
              <span className="text-[10px] uppercase text-[var(--color-text-secondary)]">
                Live preview
              </span>
            </div>
            {(seoTitle || seoDescription) && (
              <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('googlePreview')}
                </p>
                {seoSlug && (
                  <p className="truncate text-[11px] text-emerald-700">pulito.trade › {seoSlug}</p>
                )}
                <p className="truncate text-base font-medium text-blue-700">
                  {seoTitle || t('noTitle')}
                </p>
                <p className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                  {seoDescription || t('noDescription')}
                </p>
              </div>
            )}
            <div className="preview-content max-h-[600px] overflow-y-auto text-sm">{preview}</div>
          </div>
        )}
      </div>
    </div>
  );
}
