'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
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

const ISSUE_LABELS: Record<ImageIssue, { label: string; color: string }> = {
  noImages: { label: 'Зовсім без фото', color: 'bg-red-100 text-red-700 border-red-200' },
  missingMain: {
    label: 'Немає головного',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  tooSmall: { label: 'Замале фото (<800px)', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  missingAlt: { label: 'Без alt', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  tooFew: { label: 'Менше 3 фото', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export default function ImageQualityPage() {
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
          toast.error(res.error || 'Не вдалося завантажити звіт');
        }
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === 'all' ? reports : reports.filter((r) => r.issues.includes(filter));

  const counts: Record<string, number> = {};
  for (const r of reports) for (const i of r.issues) counts[i] = (counts[i] ?? 0) + 1;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Якість зображень</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Товари, які потребують пере-фотографування або правки метаданих.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`Усі (${reports.length})`}
        />
        {(Object.keys(ISSUE_LABELS) as ImageIssue[]).map((key) => {
          const meta = ISSUE_LABELS[key];
          return (
            <FilterPill
              key={key}
              active={filter === key}
              onClick={() => setFilter(key)}
              label={`${meta.label} (${counts[key] ?? 0})`}
              className={meta.color}
            />
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Все добре з обраним фільтром.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-3 py-3 text-left font-medium">Фото</th>
                <th className="px-3 py-3 text-left font-medium">Артикул</th>
                <th className="px-3 py-3 text-left font-medium">Товар</th>
                <th className="px-3 py-3 text-center font-medium">Фото</th>
                <th className="px-3 py-3 text-left font-medium">Проблеми</th>
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
                        ні фото
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
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ISSUE_LABELS[issue].color}`}
                        >
                          {ISSUE_LABELS[issue].label}
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
          : className ?? 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'
      }`}
    >
      {label}
    </button>
  );
}
