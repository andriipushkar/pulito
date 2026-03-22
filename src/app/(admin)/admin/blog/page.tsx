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
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadPosts = () => {
    setIsLoading(true);
    apiClient
      .get<BlogPost[]>('/api/v1/admin/blog')
      .then((res) => {
        if (res.success && res.data) setPosts(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadPosts(); }, []);

  const handleDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/blog/${id}`);
    if (res.success) toast.success('Статтю видалено');
    else toast.error(res.error || 'Помилка видалення');
    loadPosts();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={6} columns={6} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Блог</h2>
        <div className="flex gap-2">
          <Link href="/admin/blog/categories">
            <Button variant="outline">Категорії</Button>
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
                    <Link href={`/admin/blog/${post.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
                      Редагувати
                    </Link>
                    <button onClick={() => setDeleteId(post.id)} className="text-xs text-[var(--color-danger)] hover:underline">
                      Видалити
                    </button>
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
