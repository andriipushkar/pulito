'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

type ImageIssue = 'noImages' | 'missingMain' | 'tooSmall' | 'missingAlt' | 'tooFew';

interface ImageQualityReport {
  productId: number;
  name: string;
  code: string;
  issues: ImageIssue[];
  imageCount: number;
  mainImage: {
    id: number;
    width: number | null;
    height: number | null;
    altText: string | null;
    pathThumbnail: string | null;
  } | null;
}

const ISSUE_COLORS: Record<ImageIssue, string> = {
  noImages: 'bg-red-100 text-red-700 border-red-200',
  missingMain: 'bg-orange-100 text-orange-700 border-orange-200',
  tooSmall: 'bg-amber-100 text-amber-700 border-amber-200',
  missingAlt: 'bg-blue-100 text-blue-700 border-blue-200',
  tooFew: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function ImageQualityPage() {
  const t = useTranslations('admin.imageQualityPage');
  const ISSUE_LABELS: Record<ImageIssue, string> = {
    noImages: t('issueNoImages'),
    missingMain: t('issueMissingMain'),
    tooSmall: t('issueTooSmall'),
    missingAlt: t('issueMissingAlt'),
    tooFew: t('issueTooFew'),
  };
  const [reports, setReports] = useState<ImageQualityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ImageIssue | 'all'>('all');

  useEffect(() => {
    apiClient
      .get<ImageQualityReport[]>('/api/v1/admin/products/image-quality')
      .then((res) => {
        if (res.success && res.data) {
          setReports(res.data);
        } else {
          toast.error(res.error || t('loadError'));
        }
      })
      .catch(() => toast.error(t('networkError')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.issues.includes(filter));

  const counts: Record<string, number> = {};
  for (const r of reports) for (const i of r.issues) counts[i] = (counts[i] ?? 0) + 1;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={t('filterAll', { count: reports.length })}
        />
        {(Object.keys(ISSUE_LABELS) as ImageIssue[]).map((key) => (
          <FilterPill
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
            label={t('filterIssue', { label: ISSUE_LABELS[key], count: counts[key] ?? 0 })}
            className={ISSUE_COLORS[key]}
          />
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-3 py-3 text-left font-medium">{t('colPhoto')}</th>
                <th className="px-3 py-3 text-left font-medium">{t('colSku')}</th>
                <th className="px-3 py-3 text-left font-medium">{t('colProduct')}</th>
                <th className="px-3 py-3 text-center font-medium">{t('colCount')}</th>
                <th className="px-3 py-3 text-left font-medium">{t('colIssues')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.productId}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-3 py-2">
                    {r.mainImage?.pathThumbnail ? (
                      <Image
                        src={r.mainImage.pathThumbnail}
                        alt={r.mainImage.altText || r.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-bg-secondary)] text-[10px] text-[var(--color-text-secondary)]">
                        {t('noPhoto')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/products/${r.productId}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.mainImage?.width && r.mainImage?.height && (
                      <p className="text-[10px] text-[var(--color-text-secondary)]">
                        {r.mainImage.width}×{r.mainImage.height}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{r.imageCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.issues.map((issue) => (
                        <span
                          key={issue}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ISSUE_COLORS[issue]}`}
                        >
                          {ISSUE_LABELS[issue]}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 font-medium transition-colors ${
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
          : (className ??
            'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]')
      }`}
    >
      {label}
    </button>
  );
}
