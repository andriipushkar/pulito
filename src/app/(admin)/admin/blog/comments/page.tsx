'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';

type Status = 'pending' | 'approved' | 'rejected' | 'spam';

interface Comment {
  id: number;
  postId: number;
  authorName: string;
  authorEmail: string | null;
  authorUserId: number | null;
  content: string;
  status: Status;
  ipAddress: string | null;
  parentId: number | null;
  createdAt: string;
  approvedAt: string | null;
  post: { id: number; title: string; slug: string };
  _count?: { replies: number };
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Очікує модерації',
  approved: 'Схвалено',
  rejected: 'Відхилено',
  spam: 'Спам',
};

const STATUS_COLOR: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-gray-100 text-gray-500',
  spam: 'bg-red-100 text-red-700',
};

export default function BlogCommentsModerationPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<Status | ''>('pending');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setIsLoading(true);
    const qs = status ? `?status=${status}` : '';
    const res = await apiClient.get<Comment[]>(`/api/v1/admin/blog-comments${qs}`);
    if (res.success && res.data) setComments(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const act = async (id: number, action: 'approve' | 'reject' | 'spam') => {
    setBusyId(id);
    const res = await apiClient.put(`/api/v1/admin/blog-comments/${id}`, { action });
    setBusyId(null);
    if (res.success) {
      toast.success(action === 'approve' ? 'Схвалено' : action === 'spam' ? 'Помічено як спам' : 'Відхилено');
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Видалити коментар повністю?')) return;
    setBusyId(id);
    const res = await apiClient.delete(`/api/v1/admin/blog-comments/${id}`);
    setBusyId(null);
    if (res.success) {
      toast.success('Видалено');
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Коментарі блогу</h1>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'spam', ''] as const).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs ${
                status === s
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {s ? STATUS_LABEL[s] : 'Всі'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-secondary)]">Завантаження…</p>}
      {!isLoading && comments.length === 0 && (
        <p className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
          Коментарів немає
        </p>
      )}

      <div className="space-y-3">
        {comments.map((c) => (
          <div
            key={c.id}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
              <strong>{c.authorName}</strong>
              {c.authorEmail && <span className="text-[var(--color-text-secondary)]">{c.authorEmail}</span>}
              <span className="text-[var(--color-text-secondary)]">
                {new Date(c.createdAt).toLocaleString('uk-UA')}
              </span>
              {c.ipAddress && (
                <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">
                  {c.ipAddress}
                </span>
              )}
              <Link
                href={`/blog/${c.post.slug}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-[var(--color-primary)] hover:underline"
              >
                ↗ {c.post.title}
              </Link>
            </div>
            <p className="whitespace-pre-wrap text-sm">{c.content}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status !== 'approved' && (
                <Button size="sm" onClick={() => act(c.id, 'approve')} disabled={busyId === c.id}>
                  ✓ Схвалити
                </Button>
              )}
              {c.status !== 'rejected' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(c.id, 'reject')}
                  disabled={busyId === c.id}
                >
                  ✗ Відхилити
                </Button>
              )}
              {c.status !== 'spam' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(c.id, 'spam')}
                  disabled={busyId === c.id}
                >
                  🛑 Спам
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => remove(c.id)} disabled={busyId === c.id}>
                🗑 Видалити
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
