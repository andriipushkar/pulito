'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient, getAccessToken } from '@/lib/api-client';
import { USER_ROLE_LABELS, WHOLESALE_STATUS_LABELS, WHOLESALE_GROUP_LABELS } from '@/types/user';
import type { UserListItem, UserRole, WholesaleStatus, WholesaleGroup } from '@/types/user';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import SavedViews from '@/components/admin/SavedViews';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import { useDebounce } from '@/hooks/useDebounce';
import { Search } from '@/components/icons';
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';

const ROLE_OPTIONS = [
  { value: '', label: 'Всі ролі' },
  ...Object.entries(USER_ROLE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const WHOLESALE_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  { value: 'pending', label: 'Очікує підтвердження' },
  { value: 'approved', label: 'Підтверджено' },
  { value: 'rejected', label: 'Відхилено' },
];

const WHOLESALE_GROUP_OPTIONS = [
  { value: '', label: 'Всі групи' },
  ...Object.entries(WHOLESALE_GROUP_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const BLOCKED_OPTIONS = [
  { value: '', label: 'Усі' },
  { value: 'false', label: 'Активні' },
  { value: 'true', label: 'Заблоковані' },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Найновіші' },
  { value: 'createdAt:asc', label: 'Найстаріші' },
  { value: 'fullName:asc', label: "Ім'я (А-Я)" },
  { value: 'fullName:desc', label: "Ім'я (Я-А)" },
  { value: 'orders:desc', label: 'Замовлень (більше)' },
  { value: 'orders:asc', label: 'Замовлень (менше)' },
];

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [pendingGroupByUser, setPendingGroupByUser] = useState<Record<number, number>>({});
  const [confirmAction, setConfirmAction] = useState<{
    userId: number;
    action: 'approve' | 'reject';
    userName: string;
    wholesaleGroup?: number;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  // Multi-select for bulk wholesale approve. We don't allow bulk-reject
  // because rejection usually needs a per-user reason; the dropdown reuses
  // the per-row mechanism for rejects.
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const handleBulkApprove = async (group: number) => {
    if (bulkSelectedIds.size === 0) return;
    if (
      !window.confirm(
        `Затвердити ${bulkSelectedIds.size} гуртових заявок у групу ${group}? Дію не можна скасувати скопом.`,
      )
    )
      return;
    setIsBulkApproving(true);
    const ids = Array.from(bulkSelectedIds);
    const results = await Promise.allSettled(
      ids.map((id) =>
        apiClient.put(`/api/v1/admin/users/${id}/wholesale`, {
          action: 'approve',
          wholesaleGroup: group,
        }),
      ),
    );
    const ok = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success,
    ).length;
    const failed = ids.length - ok;
    if (ok > 0) toast.success(`Затверджено ${ok} заявок у групу ${group}`);
    if (failed > 0) toast.error(`Не вдалося затвердити ${failed} заявок`);
    setBulkSelectedIds(new Set());
    setIsBulkApproving(false);
    loadUsers();
  };

  const page = Number(searchParams.get('page')) || 1;
  const role = searchParams.get('role') || '';
  const wholesaleStatus = searchParams.get('wholesaleStatus') || '';
  const wholesaleGroup = searchParams.get('wholesaleGroup') || '';
  const isBlocked = searchParams.get('isBlocked') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const search = searchParams.get('search') || '';
  const sortParam = searchParams.get('sort') || 'createdAt:desc';
  const [sortBy, sortOrder] = sortParam.split(':') as [string, string];
  const limit = Number(searchParams.get('limit')) || DEFAULT_PAGE_SIZE;

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      updateFilter('search', debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasFilters = !!(
    role ||
    wholesaleStatus ||
    wholesaleGroup ||
    isBlocked ||
    dateFrom ||
    dateTo ||
    search
  );

  const loadUsers = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    });
    if (role) params.set('role', role);
    if (wholesaleStatus) params.set('wholesaleStatus', wholesaleStatus);
    if (wholesaleGroup) params.set('wholesaleGroup', wholesaleGroup);
    if (isBlocked) params.set('isBlocked', isBlocked);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (search) params.set('search', search);

    apiClient
      .get<UserListItem[]>(`/api/v1/admin/users?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setUsers(res.data);
          setTotal(res.pagination?.total || 0);
        } else {
          toast.error('Не вдалося завантажити користувачів');
        }
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, [
    page,
    limit,
    role,
    wholesaleStatus,
    wholesaleGroup,
    isBlocked,
    dateFrom,
    dateTo,
    search,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/users?${params}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', String(size));
    params.set('page', '1');
    router.push(`/admin/users?${params}`);
  };

  const handleWholesaleConfirm = async () => {
    if (!confirmAction || isConfirming) return;
    setIsConfirming(true);
    try {
      const res = await apiClient.put(`/api/v1/admin/users/${confirmAction.userId}/wholesale`, {
        action: confirmAction.action,
        wholesaleGroup: confirmAction.wholesaleGroup || 1,
      });
      if (res.success) {
        toast.success(
          confirmAction.action === 'approve'
            ? `Гуртовий доступ надано для ${confirmAction.userName}`
            : `Заявку відхилено для ${confirmAction.userName}`,
        );
        loadUsers();
      } else if (res.statusCode === 409) {
        // Race-conflict: another admin processed the same request.
        toast.error('Запит уже опрацьовано іншим адміністратором — оновлюю список', {
          duration: 6000,
        });
        loadUsers();
      } else {
        toast.error(res.error || 'Помилка');
      }
    } catch {
      toast.error('Помилка мережі — спробуйте ще раз');
    } finally {
      setConfirmAction(null);
      setIsConfirming(false);
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams({ type: 'clients', format: 'xlsx' });
    if (role) params.set('role', role);
    if (wholesaleStatus) params.set('wholesaleStatus', wholesaleStatus);
    if (wholesaleGroup) params.set('wholesaleGroup', wholesaleGroup);
    if (isBlocked) params.set('isBlocked', isBlocked);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (search) params.set('search', search);

    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/admin/export?${params}`, {
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        toast.error('Помилка експорту');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ||
        `clients_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Експорт завершено');
    } catch {
      toast.error('Помилка експорту');
    }
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Користувачі</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Сховати фільтри' : 'Фільтри'}
            {hasFilters && !showFilters && (
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            Експорт
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <SavedViews storageKey="users" basePath="/admin/users" />
      </div>

      {bulkSelectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 px-3 py-2 text-sm">
          <span>
            Обрано: <strong>{bulkSelectedIds.size}</strong> для bulk-затвердження
          </span>
          {Object.entries(WHOLESALE_GROUP_LABELS).map(([v, l]) => (
            <Button
              key={v}
              size="sm"
              variant="outline"
              onClick={() => handleBulkApprove(Number(v))}
              disabled={isBulkApproving}
            >
              ✓ У групу {l}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkSelectedIds(new Set())}
            disabled={isBulkApproving}
          >
            Скинути
          </Button>
        </div>
      )}

      {/* Search + Sort */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Email, ім'я, телефон, компанія..."
            className="w-64 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          options={SORT_OPTIONS}
          value={sortParam}
          onChange={(e) => updateFilter('sort', e.target.value)}
          className="w-48"
        />
        {hasFilters && (
          <button
            onClick={() => router.push('/admin/users')}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline"
          >
            Скинути фільтри
          </button>
        )}
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Роль
            </label>
            <Select
              options={ROLE_OPTIONS}
              value={role}
              onChange={(e) => updateFilter('role', e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Гуртовий статус
            </label>
            <Select
              options={WHOLESALE_OPTIONS}
              value={wholesaleStatus}
              onChange={(e) => updateFilter('wholesaleStatus', e.target.value)}
              className="w-48"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Гуртова група
            </label>
            <Select
              options={WHOLESALE_GROUP_OPTIONS}
              value={wholesaleGroup}
              onChange={(e) => updateFilter('wholesaleGroup', e.target.value)}
              className="w-36"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Доступ
            </label>
            <Select
              options={BLOCKED_OPTIONS}
              value={isBlocked}
              onChange={(e) => updateFilter('isBlocked', e.target.value)}
              className="w-36"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Зареєстрований від
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-[7px] text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Зареєстрований до
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-[7px] text-sm"
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={10} columns={7} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-3 text-left font-medium">Користувач</th>
                  <th className="px-4 py-3 text-left font-medium">Роль</th>
                  <th className="px-4 py-3 text-left font-medium">Опт</th>
                  <th className="px-4 py-3 text-center font-medium">Група</th>
                  <th className="px-4 py-3 text-center font-medium">Замовлень</th>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-right font-medium">Дії</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {u.fullName}
                        </Link>
                        {u.isBlocked && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                            Заблоковано
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">{u.email}</p>
                      {u.phone && (
                        <p className="text-xs text-[var(--color-text-secondary)]">{u.phone}</p>
                      )}
                      {u.companyName && (
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          🏢 {u.companyName}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">{USER_ROLE_LABELS[u.role as UserRole]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.wholesaleStatus === 'pending'
                            ? 'font-semibold text-[var(--color-primary)]'
                            : ''
                        }
                      >
                        {WHOLESALE_STATUS_LABELS[u.wholesaleStatus as WholesaleStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.wholesaleGroup ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.wholesaleGroup === 1
                              ? 'bg-blue-100 text-blue-700'
                              : u.wholesaleGroup === 2
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {WHOLESALE_GROUP_LABELS[u.wholesaleGroup as WholesaleGroup]}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{u._count.orders}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.wholesaleStatus === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="checkbox"
                            checked={bulkSelectedIds.has(u.id)}
                            onChange={(e) => {
                              setBulkSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(u.id);
                                else next.delete(u.id);
                                return next;
                              });
                            }}
                            className="mr-1 accent-[var(--color-primary)]"
                            aria-label={`Обрати ${u.fullName} для bulk-approve`}
                          />
                          <select
                            className="rounded border border-[var(--color-border)] bg-white px-1.5 py-1 text-xs"
                            value={pendingGroupByUser[u.id] ?? 1}
                            onChange={(e) =>
                              setPendingGroupByUser((prev) => ({
                                ...prev,
                                [u.id]: Number(e.target.value),
                              }))
                            }
                            aria-label={`Гуртова група для ${u.fullName}`}
                          >
                            {Object.entries(WHOLESALE_GROUP_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() =>
                              setConfirmAction({
                                userId: u.id,
                                action: 'approve',
                                userName: u.fullName,
                                wholesaleGroup: pendingGroupByUser[u.id] ?? 1,
                              })
                            }
                          >
                            Так
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              setConfirmAction({
                                userId: u.id,
                                action: 'reject',
                                userName: u.fullName,
                              })
                            }
                          >
                            Ні
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                        <span className="text-3xl" aria-hidden="true">
                          👥
                        </span>
                        <p className="text-sm font-medium">Користувачів не знайдено</p>
                        {hasFilters ? (
                          <button
                            onClick={() => router.push('/admin/users')}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            Скинути всі фільтри
                          </button>
                        ) : (
                          <p className="text-xs">Тут з&apos;являться зареєстровані користувачі</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-[var(--color-text-secondary)]">Всього: {total}</p>
              <PageSizeSelector value={limit} onChange={handlePageSizeChange} />
            </div>
            {total > limit && (
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / limit)}
                baseUrl="/admin/users"
              />
            )}
          </div>
        </>
      )}

      {/* Confirm wholesale action */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => !isConfirming && setConfirmAction(null)}
        onConfirm={handleWholesaleConfirm}
        isLoading={isConfirming}
        variant={confirmAction?.action === 'reject' ? 'danger' : 'default'}
        title={
          confirmAction?.action === 'approve' ? 'Підтвердити гуртовий доступ' : 'Відхилити заявку'
        }
        message={
          confirmAction?.action === 'approve'
            ? `Надати гуртовий доступ користувачу "${confirmAction?.userName}"?`
            : `Відхилити заявку на гуртовий доступ від "${confirmAction?.userName}"?`
        }
        confirmText={confirmAction?.action === 'approve' ? 'Так, підтвердити' : 'Так, відхилити'}
      />
    </div>
  );
}
