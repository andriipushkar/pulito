'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface ProductNote {
  id: number;
  noteText: string;
  product: { id: number; name: string; slug: string; code: string };
  createdAt: string;
}

export default function AccountNotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ProductNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    apiClient
      .get<ProductNote[]>('/api/v1/me/notes')
      .then((res) => {
        if (res.success && res.data) setNotes(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleStartEdit = (note: ProductNote) => {
    setEditingId(note.id);
    setEditText(note.noteText);
  };

  const handleSaveEdit = async (noteId: number, productId: number) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    const res = await apiClient.put(`/api/v1/me/notes/${productId}`, { noteText: trimmed });
    if (res.success) {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, noteText: trimmed } : n)));
      setEditingId(null);
      setEditText('');
    }
  };

  const handleDelete = async (noteId: number, productId: number) => {
    if (!confirm('Видалити цю нотатку?')) return;
    const res = await apiClient.delete(`/api/v1/me/notes/${productId}`);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  if (user?.role !== 'wholesaler' && user?.role !== 'admin') {
    return (
      <div className="py-8 text-center text-[var(--color-text-secondary)]">
        Розділ доступний тільки для гуртових клієнтів
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Мої нотатки до товарів</h2>

      {notes.length === 0 ? (
        <div className="py-8 text-center text-[var(--color-text-secondary)]">
          Нотаток немає. Додавайте нотатки на сторінці товару.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/product/${note.product.slug}`}
                  className="text-sm font-medium hover:text-[var(--color-primary)]"
                >
                  {note.product.name}
                </Link>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {note.product.code}
                </span>
              </div>

              {editingId === note.id ? (
                <div className="mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    aria-label="Текст нотатки"
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                    autoFocus
                  />
                  <div className="mt-1.5 flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(note.id, note.product.id)}>
                      Зберегти
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditText('');
                      }}
                    >
                      Скасувати
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 rounded bg-yellow-50 px-3 py-2 text-sm">{note.noteText}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(note.createdAt).toLocaleDateString('uk-UA')}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStartEdit(note)}
                        className="text-xs text-[var(--color-primary)] hover:underline"
                      >
                        Редагувати
                      </button>
                      <button
                        onClick={() => handleDelete(note.id, note.product.id)}
                        className="text-xs text-[var(--color-danger)] hover:underline"
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
