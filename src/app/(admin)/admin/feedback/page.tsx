'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import PageSizeSelector from '@/components/admin/PageSizeSelector';

interface FeedbackItem {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  type: string;
  status: string;
  processedAt: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  form: 'Форма зв\'язку',
  callback: 'Зворотний дзвінок',
  complaint: 'Скарга',
  suggestion: 'Пропозиція',
};

const STATUS_LABELS: Record<string, string> = {
  new_feedback: 'Новий',
  in_progress: 'В роботі',
  resolved: 'Вирішено',
  closed: 'Закрито',
};

const STATUS_COLORS: Record<string, string> = {
  new_feedback: '#f59e0b',
  in_progress: '#3b82f6',
  resolved: '#22c55e',
  closed: '#6b7280',
};

const TYPE_OPTIONS = [
  { value: '', label: 'Всі типи' },
  ...Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

export default function AdminFeedbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const limit = Number(searchParams.get('limit')) || 20;
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    apiClient
      .get<FeedbackItem[]>(`/api/v1/admin/feedback?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setItems(res.data);
          setTotal(res.pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, type, status, search, dateFrom, dateTo, limit]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/feedback?${params}`);
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await apiClient.put(`/api/v1/admin/feedback/${id}`, { status: newStatus });
      if (res.success) {
        setItems((prev) => prev.map((item) =>
          item.id === id ? { ...item, status: newStatus, processedAt: new Date().toISOString() } : item
        ));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Зворотний зв&apos;язок</h2>
        <div className="flex flex-wrap items-end gap-2">
          <form
            onSubmit={(e) => { e.preventDefault(); updateFilter('search', searchInput.trim()); }}
            className="flex gap-1"
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ім'я або email..."
              className="w-44"
            />
            <Button size="sm" type="submit" variant="outline">Знайти</Button>
          </form>
          <Select options={TYPE_OPTIONS} value={type} onChange={(e) => updateFilter('type', e.target.value)} className="w-40" />
          <Select options={STATUS_OPTIONS} value={status} onChange={(e) => updateFilter('status', e.target.value)} className="w-36" />
          <Input type="date" value={dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} className="w-36" />
          <Input type="date" value={dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} className="w-36" />
          {(search || dateFrom || dateTo) && (
            <Button size="sm" variant="outline" onClick={() => {
              setSearchInput('');
              const params = new URLSearchParams(searchParams.toString());
              params.delete('search');
              params.delete('dateFrom');
              params.delete('dateTo');
              params.set('page', '1');
              router.push(`/admin/feedback?${params}`);
            }}>
              Скинути
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: STATUS_COLORS[item.status] }}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.subject && <span className="text-sm text-[var(--color-text-secondary)]">— {item.subject}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-secondary)]">{TYPE_LABELS[item.type]}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(item.createdAt)}</span>
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="border-t border-[var(--color-border)] px-4 py-3">
                    <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
                      {item.email && <div><span className="text-[var(--color-text-secondary)]">Email: </span>{item.email}</div>}
                      {item.phone && <div><span className="text-[var(--color-text-secondary)]">Телефон: </span>{item.phone}</div>}
                      {item.processedAt && <div><span className="text-[var(--color-text-secondary)]">Оброблено: </span>{formatDate(item.processedAt)}</div>}
                    </div>
                    <p className="mb-4 whitespace-pre-wrap rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3 text-sm">{item.message}</p>
                    <div className="flex gap-2">
                      {item.status === 'new_feedback' && (
                        <Button size="sm" onClick={() => handleStatusUpdate(item.id, 'in_progress')} isLoading={updatingId === item.id}>
                          Взяти в роботу
                        </Button>
                      )}
                      {item.status === 'in_progress' && (
                        <Button size="sm" onClick={() => handleStatusUpdate(item.id, 'resolved')} isLoading={updatingId === item.id}>
                          Вирішено
                        </Button>
                      )}
                      {item.status !== 'closed' && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(item.id, 'closed')} isLoading={updatingId === item.id}>
                          Закрити
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-8 text-center text-[var(--color-text-secondary)]">
                Зверненнь не знайдено
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <PageSizeSelector value={limit} onChange={(size) => updateFilter('limit', String(size))} />
            {total > limit && (
              <Pagination currentPage={page} totalPages={Math.ceil(total / limit)} baseUrl="/admin/feedback" className="" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
