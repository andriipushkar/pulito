'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import PageSizeSelector from '@/components/admin/PageSizeSelector';
import { DEFAULT_PAGE_SIZE } from '@/config/admin-constants';

interface ChatRoomItem {
  id: number;
  status: string;
  subject: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  user: { id: number; fullName: string; email: string };
  assignedAgent: { id: number; fullName: string } | null;
  messages: { content: string; senderType: string; createdAt: string }[];
  _count: { messages: number };
}

const STATUS_OPTIONS = [
  { value: '', label: 'Всі статуси' },
  { value: 'open', label: 'Відкриті' },
  { value: 'assigned', label: 'В роботі' },
  { value: 'resolved', label: 'Вирішені' },
  { value: 'closed', label: 'Закриті' },
];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  assigned: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Відкритий',
  assigned: 'В роботі',
  resolved: 'Вирішено',
  closed: 'Закрито',
};

export default function AdminChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [total, setTotal] = useState(0);
  // Derive isLoading from request/completion tokens to avoid synchronous setState in effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const loadRooms = useCallback(() => setReloadToken((n) => n + 1), []);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const limit = Number(searchParams.get('limit')) || DEFAULT_PAGE_SIZE;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (status) params.set('status', status);

    apiClient
      .get<ChatRoomItem[]>(`/api/v1/admin/chat?${params}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setRooms(res.data);
          setTotal(res.pagination?.total || 0);
        } else {
          toast.error('Не вдалося завантажити чати');
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Помилка мережі');
      })
      .finally(() => {
        if (!cancelled) setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [page, limit, status, reloadToken]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadRooms, 10000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    router.push(`/admin/chat?${params}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', String(size));
    params.set('page', '1');
    router.push(`/admin/chat?${params}`);
  };

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleString('uk-UA', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Чати підтримки</h2>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="w-40"
        />
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={10} columns={6} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-3 py-3 text-left font-medium">ID</th>
                  <th className="px-3 py-3 text-left font-medium">Клієнт</th>
                  <th className="px-3 py-3 text-left font-medium">Тема</th>
                  <th className="px-3 py-3 text-left font-medium">Статус</th>
                  <th className="px-3 py-3 text-left font-medium">Агент</th>
                  <th className="px-3 py-3 text-left font-medium">Останнє повідомлення</th>
                  <th className="px-3 py-3 text-center font-medium">Непрочитані</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr
                    key={room.id}
                    className="border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/chat/${room.id}`}
                        className="font-medium text-[var(--color-primary)] hover:underline"
                      >
                        #{room.id}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-sm">{room.user.fullName}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{room.user.email}</p>
                    </td>
                    <td className="px-3 py-3 max-w-[200px]">
                      <p className="truncate text-sm">{room.subject || '-'}</p>
                      {room.messages[0] && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                          {room.messages[0].content}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[room.status] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {STATUS_LABELS[room.status] || room.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {room.assignedAgent?.fullName || (
                        <span className="text-[var(--color-text-secondary)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)]">
                      {formatDate(room.lastMessageAt)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {room._count.messages > 0 ? (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {room._count.messages}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">0</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                      Чатів не знайдено
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
                baseUrl="/admin/chat"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
