'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface AdminPage {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<AdminPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<AdminPage[]>('/api/v1/admin/pages')
      .then((res) => {
        if (res.success && res.data) setPages(res.data);
        else toast.error('Не вдалося завантажити сторінки');
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={5} />;
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Статичні сторінки</h2>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Заголовок</th>
              <th className="px-4 py-3 text-left font-medium">Slug</th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-left font-medium">Оновлено</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">/{p.slug}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isPublished ? 'Опубліковано' : 'Чернетка'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDate(p.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/pages/${p.id}`} className="text-xs text-[var(--color-primary)] hover:underline">Редагувати</Link>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Сторінок немає
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
