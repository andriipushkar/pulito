'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Plus, Trash, Check, Close, ChevronDown } from '@/components/icons';

interface AdminFaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  clickCount: number;
}

interface FaqFormData {
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
}

const emptyForm: FaqFormData = {
  category: '',
  question: '',
  answer: '',
  sortOrder: 0,
  isPublished: false,
};

export default function AdminFaqPage() {
  const [items, setItems] = useState<AdminFaqItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<FaqFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FaqFormData>(emptyForm);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'sortOrder' | 'question' | 'clickCount'>('sortOrder');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchItems = useCallback(() => {
    apiClient
      .get<AdminFaqItem[]>('/api/v1/admin/faq')
      .then((res) => {
        if (res.success && res.data) setItems(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const categories = [...new Set(items.map((i) => i.category))].sort();

  const sortedItems = [...items].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'question') cmp = a.question.localeCompare(b.question, 'uk');
    else cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const filteredItems = filterCategory
    ? sortedItems.filter((i) => i.category === filterCategory)
    : sortedItems;

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const grouped = filteredItems.reduce<Record<string, AdminFaqItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await apiClient.post<AdminFaqItem>('/api/v1/admin/faq', createForm);
    if (res.success && res.data) {
      toast.success('Питання створено');
      setItems((prev) => [...prev, res.data!]);
      setCreateForm(emptyForm);
      setShowCreateForm(false);
    } else {
      toast.error(res.error || 'Помилка створення');
    }
    setSaving(false);
  }

  async function handleUpdate(id: number) {
    setSaving(true);
    const res = await apiClient.put<AdminFaqItem>(`/api/v1/admin/faq/${id}`, editForm);
    if (res.success && res.data) {
      toast.success('Питання оновлено');
      setItems((prev) => prev.map((item) => (item.id === id ? res.data! : item)));
      setEditingId(null);
    } else {
      toast.error(res.error || 'Помилка');
    }
    setSaving(false);
  }

  function handleDelete(id: number) {
    setDeleteId(id);
  }

  async function executeDelete() {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/faq/${id}`);
    if (res.success) {
      toast.success('Питання видалено');
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      toast.error('Помилка видалення');
    }
  }

  async function handleTogglePublished(item: AdminFaqItem) {
    const res = await apiClient.put<AdminFaqItem>(`/api/v1/admin/faq/${item.id}`, {
      isPublished: !item.isPublished,
    });
    if (res.success && res.data) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data! : i)));
    }
  }

  function startEdit(item: AdminFaqItem) {
    setEditingId(item.id);
    setEditForm({
      category: item.category,
      question: item.question,
      answer: item.answer,
      sortOrder: item.sortOrder,
      isPublished: item.isPublished,
    });
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">FAQ</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-2 text-sm text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          <Plus size={16} /> Додати питання
        </button>
      </div>

      {/* Filters and sorting */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {categories.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Фільтр:</span>
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 pl-3 pr-8 text-sm"
              >
                <option value="">Всі категорії</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            </div>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[var(--color-text-secondary)]">Сортувати:</span>
          {([['sortOrder', 'Порядок'], ['question', 'Питання'], ['clickCount', 'Кліки']] as const).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`rounded px-2 py-1 ${sortField === field ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
            >
              {label} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          ))}
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-[var(--radius)] border border-[var(--color-primary)] bg-[var(--color-bg)] p-4"
        >
          <h3 className="mb-3 text-sm font-semibold">Нове питання</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Категорія"
              value={createForm.category}
              onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm"
              required
            />
            <input
              type="number"
              placeholder="Порядок"
              value={createForm.sortOrder}
              onChange={(e) => setCreateForm({ ...createForm, sortOrder: Number(e.target.value) })}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm"
              min={0}
            />
          </div>
          <input
            type="text"
            placeholder="Питання"
            value={createForm.question}
            onChange={(e) => setCreateForm({ ...createForm, question: e.target.value })}
            className="mt-3 w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm"
            required
            minLength={5}
          />
          <textarea
            placeholder="Відповідь"
            value={createForm.answer}
            onChange={(e) => setCreateForm({ ...createForm, answer: e.target.value })}
            className="mt-3 w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2 text-sm"
            rows={3}
            required
            minLength={5}
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.isPublished}
                onChange={(e) => setCreateForm({ ...createForm, isPublished: e.target.checked })}
              />
              Опублікувати одразу
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm(emptyForm);
                }}
                className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {saving ? 'Збереження...' : 'Створити'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* FAQ items grouped by category */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
            {category}
          </h3>
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            {catItems.map((item, i) => (
              <div
                key={item.id}
                className={`px-4 py-3 ${i > 0 ? 'border-t border-[var(--color-border)]' : ''}`}
              >
                {editingId === item.id ? (
                  /* Inline edit form */
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                        placeholder="Категорія"
                      />
                      <input
                        type="number"
                        value={editForm.sortOrder}
                        onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) })}
                        className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                        min={0}
                      />
                    </div>
                    <input
                      type="text"
                      value={editForm.question}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                      placeholder="Питання"
                    />
                    <textarea
                      value={editForm.answer}
                      onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                      rows={3}
                      placeholder="Відповідь"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm.isPublished}
                          onChange={(e) => setEditForm({ ...editForm, isPublished: e.target.checked })}
                        />
                        Опубліковано
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"
                          title="Скасувати"
                        >
                          <Close size={16} />
                        </button>
                        <button
                          onClick={() => handleUpdate(item.id)}
                          disabled={saving}
                          className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white disabled:opacity-50"
                          title="Зберегти"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.question}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                        {item.answer}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {item.clickCount} кліків
                      </span>
                      <button
                        onClick={() => handleTogglePublished(item)}
                        className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                          item.isPublished
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {item.isPublished ? 'Опубл.' : 'Чернетка'}
                      </button>
                      <button
                        onClick={() => startEdit(item)}
                        className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                      >
                        Редагувати
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-[var(--radius)] p-1 text-[var(--color-danger)] hover:bg-red-50"
                        title="Видалити"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredItems.length === 0 && (
        <div className="py-8 text-center text-[var(--color-text-secondary)]">
          {filterCategory ? 'Немає питань у цій категорії' : 'FAQ порожній'}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message="Видалити це питання?"
      />
    </div>
  );
}
