'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  category: string;
  status: 'published' | 'draft';
  views: number;
  createdAt: string;
  deletedAt?: string | null;
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Derive isLoading from request/completion tokens to avoid synchronous setState in effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const loadPosts = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    const qs = showArchived ? '?includeDeleted=true' : '';
    apiClient
      .get<BlogPost[]>(`/api/v1/admin/blog${qs}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setPosts(res.data);
        else toast.error(res.error || 'Помилка завантаження статей');
      })
      .catch(() => {
        if (!cancelled) toast.error('Помилка завантаження статей');
      })
      .finally(() => {
        if (!cancelled) setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, showArchived]);

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/blog/${id}`);
    if (res.success) toast.success('Статтю видалено');
    else toast.error(res.error || 'Помилка видалення');
    loadPosts();
  };

  const handleRestore = async (id: number) => {
    const res = await apiClient.post(`/api/v1/admin/blog/${id}/restore`);
    if (res.success) toast.success('Статтю відновлено (залишається чернеткою)');
    else toast.error(res.error || 'Не вдалося відновити');
    loadPosts();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={6} columns={6} />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Блог</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Показати архівні
          </label>
          <Link href="/admin/blog/categories">
            <Button variant="outline">Категорії</Button>
          </Link>
          <Link href="/admin/blog/comments">
            <Button variant="outline">💬 Коментарі</Button>
          </Link>
          <Link href="/admin/blog/new">
            <Button>+ Нова стаття</Button>
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Заголовок</th>
              <th className="px-4 py-3 text-left font-medium">Категорія</th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-right font-medium">Перегляди</th>
              <th className="px-4 py-3 text-left font-medium">Дата</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3">
                  <Link href={`/admin/blog/${post.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {post.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{post.category || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {post.status === 'published' ? 'Опубліковано' : 'Чернетка'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{post.views}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {new Date(post.createdAt).toLocaleDateString('uk-UA')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {post.deletedAt ? (
                      <>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          🗑 архівовано
                        </span>
                        <button
                          onClick={() => handleRestore(post.id)}
                          className="text-xs text-emerald-600 hover:underline"
                        >
                          ↻ Відновити
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={`/admin/blog/${post.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
                          Редагувати
                        </Link>
                        <button onClick={() => setDeleteId(post.id)} className="text-xs text-[var(--color-danger)] hover:underline">
                          Видалити
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Статей немає
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        variant="danger"
        message="Видалити статтю?"
      />
    </div>
  );
}
