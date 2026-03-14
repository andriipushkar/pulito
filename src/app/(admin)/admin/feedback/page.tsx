'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';

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
};

// Aligned with DB enum: FeedbackStatus = new_feedback | processed | rejected
const STATUS_LABELS: Record<string, string> = {
  new_feedback: 'Новий',
  processed: 'Оброблено',
  rejected: 'Відхилено',
};

const STATUS_COLORS: Record<string, string> = {
  new_feedback: '#f59e0b',
  processed: '#22c55e',
  rejected: '#6b7280',
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
  const [confirmAction, setConfirmAction] = useState<{ id: number; status: string } | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const limit = Number(searchParams.get('limit')) || 20;
  const [searchInput, setSearchInput] = useState(search);

  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      updateFilter('search', debouncedSearch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

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
        } else {
          toast.error('Не вдалося завантажити звернення');
        }
      })
      .catch(() => toast.error('Помилка мережі'))
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
    setConfirmAction(null);
    setUpdatingId(id);
    try {
      const res = await apiClient.put(`/api/v1/admin/feedback/${id}`, { status: newStatus });
      if (res.success) {
        setItems((prev) => prev.map((item) =>
          item.id === id ? { ...item, status: newStatus, processedAt: new Date().toISOString() } : item
        ));
        toast.success(`Статус змінено на "${STATUS_LABELS[newStatus]}"`);
      } else {
        toast.error(res.error || 'Помилка зміни статусу');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Зворотний зв&apos;язок <span className="text-base font-normal text-[var(--color-text-secondary)]">({total})</span></h2>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Ім'я або email..."
            className="w-44"
          />
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
        <AdminTableSkeleton rows={6} columns={4} />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors hover:border-[var(--color-primary)]/30">
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: STATUS_COLORS[item.status] || '#6b7280' }}
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.subject && <span className="text-sm text-[var(--color-text-secondary)]">— {item.subject}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-secondary)]">{TYPE_LABELS[item.type] || item.type}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(item.createdAt)}</span>
                    <svg className={`h-4 w-4 text-[var(--color-text-secondary)] transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
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
                        <>
                          <Button size="sm" onClick={() => setConfirmAction({ id: item.id, status: 'processed' })} isLoading={updatingId === item.id}>
                            Оброблено
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ id: item.id, status: 'rejected' })} isLoading={updatingId === item.id}>
                            Відхилити
                          </Button>
                        </>
                      )}
                      {item.status === 'processed' && (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">Оброблено</span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">Відхилено</span>
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <PageSizeSelector value={limit} onChange={(size) => updateFilter('limit', String(size))} />
            {total > limit && (
              <Pagination currentPage={page} totalPages={Math.ceil(total / limit)} baseUrl="/admin/feedback" />
            )}
          </div>
        </>
      )}

      {/* Confirm status change */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && handleStatusUpdate(confirmAction.id, confirmAction.status)}
        variant={confirmAction?.status === 'rejected' ? 'danger' : 'default'}
        title="Зміна статусу"
        message={confirmAction?.status === 'processed' ? 'Позначити звернення як оброблене?' : 'Відхилити звернення?'}
        confirmText={confirmAction?.status === 'processed' ? 'Так, оброблено' : 'Так, відхилити'}
      />
    </div>
  );
}
