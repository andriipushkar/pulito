'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface PublicComment {
  id: number;
  authorName: string;
  content: string;
  createdAt: string;
  parentId: number | null;
}

export default function BlogComments({ postId }: { postId: number }) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    const res = await apiClient.get<PublicComment[]>(`/api/v1/blog/comments?postId=${postId}`);
    if (res.success && res.data) setComments(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || content.trim().length < 2) {
      toast.error('Введіть імʼя та коментар (мін. 2 символи)');
      return;
    }
    setIsSubmitting(true);
    const res = await apiClient.post('/api/v1/blog/comments', {
      postId,
      authorName: name.trim(),
      authorEmail: email.trim() || null,
      content: content.trim(),
    });
    setIsSubmitting(false);
    if (res.success) {
      toast.success('Коментар надіслано на модерацію');
      setContent('');
    } else {
      toast.error(res.error || 'Не вдалося надіслати');
    }
  };

  return (
    <section className="mt-10 border-t border-[var(--color-border)] pt-8">
      <h2 className="mb-4 text-xl font-bold">
        Коментарі {comments.length > 0 && <span className="text-sm font-normal text-[var(--color-text-secondary)]">({comments.length})</span>}
      </h2>

      <form onSubmit={submit} className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше імʼя *"
            maxLength={100}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (необовʼязково)"
            maxLength={255}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ваш коментар…"
          rows={3}
          maxLength={2000}
          className="mt-3 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          required
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Коментар зʼявиться після модерації
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
          >
            {isSubmitting ? 'Відправляємо…' : 'Надіслати'}
          </button>
        </div>
      </form>

      {isLoading && <p className="text-sm text-[var(--color-text-secondary)]">Завантаження…</p>}
      {!isLoading && comments.length === 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Поки що коментарів немає — будьте першим!
        </p>
      )}

      <ul className="space-y-3">
        {comments.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
          >
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <strong>{c.authorName}</strong>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {new Date(c.createdAt).toLocaleDateString('uk-UA', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
