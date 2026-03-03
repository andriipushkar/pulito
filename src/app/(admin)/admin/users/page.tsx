'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { USER_ROLE_LABELS, WHOLESALE_STATUS_LABELS } from '@/types/user';
import type { UserListItem, UserRole, WholesaleStatus } from '@/types/user';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

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

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const page = Number(searchParams.get('page')) || 1;
  const role = searchParams.get('role') || '';
  const wholesaleStatus = searchParams.get('wholesaleStatus') || '';
  const limit = 20;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (role) params.set('role', role);
    if (wholesaleStatus) params.set('wholesaleStatus', wholesaleStatus);
    if (searchParams.get('search')) params.set('search', searchParams.get('search')!);

    apiClient
      .get<UserListItem[]>(`/api/v1/admin/users?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setUsers(res.data);
          setTotal(res.pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, role, wholesaleStatus, searchParams]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/users?${params}`);
  };

  const handleSearch = () => {
    updateFilter('search', search);
  };

  const handleWholesaleAction = async (userId: number, action: 'approve' | 'reject') => {
    await apiClient.put(`/api/v1/admin/users/${userId}/wholesale`, { action });
    // Reload
    const params = new URLSearchParams(searchParams.toString());
    apiClient.get<UserListItem[]>(`/api/v1/admin/users?${params}`).then((res) => {
      if (res.success && res.data) {
        setUsers(res.data);
        setTotal(res.pagination?.total || 0);
      }
    });
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Користувачі</h2>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex gap-2">
          <Input
            placeholder="Пошук..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-52"
          />
          <Button variant="outline" size="sm" onClick={handleSearch}>
            Знайти
          </Button>
        </div>
        <Select
          options={ROLE_OPTIONS}
          value={role}
          onChange={(e) => updateFilter('role', e.target.value)}
          className="w-40"
        />
        <Select
          options={WHOLESALE_OPTIONS}
          value={wholesaleStatus}
          onChange={(e) => updateFilter('wholesaleStatus', e.target.value)}
          className="w-52"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-3 text-left font-medium">Користувач</th>
                  <th className="px-4 py-3 text-left font-medium">Роль</th>
                  <th className="px-4 py-3 text-left font-medium">Опт</th>
                  <th className="px-4 py-3 text-center font-medium">Замовлень</th>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-right font-medium">Дії</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                        {u.fullName}
                      </Link>
                      <p className="text-xs text-[var(--color-text-secondary)]">{u.email}</p>
                      {u.companyName && (
                        <p className="text-xs text-[var(--color-text-secondary)]">{u.companyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{USER_ROLE_LABELS[u.role as UserRole]}</td>
                    <td className="px-4 py-3">
                      <span className={u.wholesaleStatus === 'pending' ? 'font-semibold text-[var(--color-primary)]' : ''}>
                        {WHOLESALE_STATUS_LABELS[u.wholesaleStatus as WholesaleStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{u._count.orders}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.wholesaleStatus === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleWholesaleAction(u.id, 'approve')}
                          >
                            Підтвердити
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleWholesaleAction(u.id, 'reject')}
                          >
                            Відхилити
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                      Користувачів не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / limit)}
              baseUrl="/admin/users"
              className="mt-6"
            />
          )}
        </>
      )}
    </div>
  );
}
