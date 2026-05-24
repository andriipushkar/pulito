'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { apiClient, getAccessToken, refreshAccessToken } from '@/lib/api-client';
import PageHeader from '@/components/account/PageHeader';
import { plural } from '@/utils/format';
import { WHOLESALE_GROUP_LABELS } from '@/types/user';

// Завантаження PDF через fetch+Bearer, а не через <a download>: <Link> не додає
// Authorization-заголовок, тому сервер бачив анонімного користувача і повертав
// 401 на гуртовий прайс. Тут ми реіспользуємо access-token з api-client, при
// 401 один раз пробуємо оновити сесію.
async function downloadPricelist(url: string, filename: string): Promise<void> {
  const send = async (token: string | null): Promise<Response> =>
    fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await send(getAccessToken());
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = 'Не вдалося завантажити прайс';
    try {
      const j = JSON.parse(text);
      if (j?.error) message = j.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

interface PricelistMeta {
  totalActive: number;
  lastUpdated: string | null;
}

const IconDownload = (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

const IconLock = (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
    />
  </svg>
);

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface PricelistCardProps {
  variant: 'retail' | 'wholesale' | 'locked';
  title: string;
  description: string;
  onDownload?: () => void | Promise<void>;
  meta?: PricelistMeta | null;
  accentBg: string;
  accentText: string;
  badgeBg: string;
  badgeText: string;
}

function PricelistCard({
  variant,
  title,
  description,
  onDownload,
  meta,
  accentBg,
  accentText,
  badgeBg,
  badgeText,
}: PricelistCardProps) {
  const isLocked = variant === 'locked';
  const className = `group relative w-full overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6 text-left transition-all ${
    isLocked ? 'opacity-60' : 'hover:-translate-y-0.5 hover:shadow-md'
  }`;

  const inner = (
    <div className="flex items-start gap-4">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${accentBg} ${accentText}`}
      >
        {isLocked ? IconLock : IconDownload}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-base font-bold ${isLocked ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text)]'}`}
          >
            {title}
          </span>
          <span
            className={`rounded-full ${badgeBg} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeText}`}
          >
            {isLocked ? 'Заблоковано' : 'PDF'}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{description}</p>
        {!isLocked && meta && (
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-secondary)]">
            <div>
              <dt className="inline">Товарів: </dt>
              <dd className="inline font-semibold text-[var(--color-text)]">
                {meta.totalActive} {plural(meta.totalActive, ['позиція', 'позиції', 'позицій'])}
              </dd>
            </div>
            <div>
              <dt className="inline">Оновлено: </dt>
              <dd className="inline font-semibold text-[var(--color-text)]">
                {formatDate(meta.lastUpdated)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );

  if (isLocked) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onDownload} className={className}>
      {inner}
    </button>
  );
}

export default function PricelistPage() {
  const { user } = useAuth();
  const [meta, setMeta] = useState<PricelistMeta | null>(null);

  // Один прайс на одного користувача. Гуртівник бачить свій тариф,
  // менеджер/адмін/роздрібний клієнт — роздрібний.
  const isWholesaler = user?.role === 'wholesaler' && !!user.wholesaleGroup;
  const tierLabel = isWholesaler ? WHOLESALE_GROUP_LABELS[user!.wholesaleGroup as 1 | 2 | 3] : null;
  const currentType: 'retail' | 'wholesale' = isWholesaler ? 'wholesale' : 'retail';

  const [downloading, setDownloading] = useState<'retail' | 'wholesale' | null>(null);

  const handleDownload = async (type: 'retail' | 'wholesale') => {
    if (downloading) return;
    setDownloading(type);
    try {
      await downloadPricelist(
        `/api/v1/pricelist?type=${type}`,
        type === 'wholesale' ? 'pricelist_wholesale.pdf' : 'pricelist_retail.pdf',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося завантажити прайс');
    } finally {
      setDownloading(null);
    }
  };

  useEffect(() => {
    apiClient.get<PricelistMeta>('/api/v1/pricelist/meta').then((res) => {
      if (res.success && res.data) setMeta(res.data);
    });
  }, []);

  return (
    <div>
      <PageHeader
        icon={
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
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

      <div className="grid gap-4">
        {currentType === 'wholesale' ? (
          <PricelistCard
            variant="wholesale"
            title={downloading === 'wholesale' ? 'Завантаження…' : `Гуртовий прайс — ${tierLabel}`}
            description={`Ваш персональний прайс з цінами рівня «${tierLabel}»`}
            onDownload={() => handleDownload('wholesale')}
            meta={meta}
            accentBg="bg-emerald-50"
            accentText="text-emerald-600"
            badgeBg="bg-emerald-50"
            badgeText="text-emerald-700"
          />
        ) : (
          <PricelistCard
            variant="retail"
            title={downloading === 'retail' ? 'Завантаження…' : 'Роздрібний прайс-лист'}
            description="Всі активні товари за роздрібними цінами"
            onDownload={() => handleDownload('retail')}
            meta={meta}
            accentBg="bg-indigo-50"
            accentText="text-indigo-600"
            badgeBg="bg-indigo-50"
            badgeText="text-indigo-700"
          />
        )}
      </div>

      {/* Personal pricelist CTA for retail users not yet wholesale */}
      {user?.role !== 'wholesaler' && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg-secondary)]/40 p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Потрібна персональна знижка?
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Подайте заявку на гуртовий рівень — отримаєте доступ до гуртового прайсу та
              індивідуальні умови.
            </p>
          </div>
          <Link
            href="/account/wholesale-request"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-md"
          >
            Запитати персональний прайс
          </Link>
        </div>
      )}
    </div>
  );
}
