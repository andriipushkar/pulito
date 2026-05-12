'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoPath: string | null;
  isVisible: boolean;
  sortOrder: number;
}

interface UploadResponse {
  path: string;
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    description: '',
    logoPath: '',
    isVisible: true,
    sortOrder: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadBrands = useCallback(() => {
    setIsLoading(true);
    apiClient
      .get<AdminBrand[]>('/api/v1/admin/brands?includeHidden=true')
      .then((res) => {
        if (res.success && res.data) setBrands(res.data);
        else toast.error(res.error || 'Не вдалося завантажити виробників');
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const handleEdit = (b: AdminBrand) => {
    setEditingId(b.id);
    setEditForm({
      name: b.name,
      slug: b.slug,
      description: b.description || '',
      logoPath: b.logoPath || '',
      isVisible: b.isVisible,
      sortOrder: b.sortOrder,
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const res = await apiClient.put<AdminBrand>(`/api/v1/admin/brands/${editingId}`, {
        name: editForm.name,
        slug: editForm.slug || undefined,
        description: editForm.description || null,
        logoPath: editForm.logoPath || null,
        isVisible: editForm.isVisible,
        sortOrder: Number(editForm.sortOrder) || 0,
      });
      if (res.success) {
        toast.success('Виробника оновлено');
        setEditingId(null);
        loadBrands();
      } else {
        toast.error(res.error || 'Не вдалося оновити');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    const name = createForm.name.trim();
    if (!name) {
      toast.error('Введіть назву виробника');
      return;
    }
    setIsCreating(true);
    try {
      const res = await apiClient.post<AdminBrand>('/api/v1/admin/brands', {
        name,
        slug: createForm.slug.trim() || undefined,
      });
      if (res.success) {
        toast.success('Виробника створено');
        setShowCreate(false);
        setCreateForm({ name: '', slug: '' });
        loadBrands();
      } else {
        toast.error(res.error || 'Не вдалося створити');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setIsDeleting(id);
    try {
      const res = await apiClient.delete<{ message?: string }>(`/api/v1/admin/brands/${id}`);
      if (res.success) {
        toast.success(res.data?.message || 'Виробника видалено');
        loadBrands();
      } else {
        toast.error(res.error || 'Не вдалося видалити');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'brands');
      const res = await apiClient.upload<UploadResponse>('/api/v1/admin/upload', formData);
      if (res.success && res.data) {
        setEditForm((prev) => ({ ...prev, logoPath: res.data!.path }));
        toast.success('Логотип завантажено');
      } else {
        toast.error(res.error || 'Не вдалося завантажити логотип');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const filtered = search
    ? brands.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.slug.toLowerCase().includes(search.toLowerCase()),
      )
    : brands;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          Виробники{' '}
          <span className="text-base font-normal text-[var(--color-text-secondary)]">
            ({brands.length})
          </span>
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Пошук..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Скасувати' : '+ Створити'}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">Новий виробник</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Назва *</label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Procter &amp; Gamble"
                className="w-64"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Slug (auto)</label>
              <Input
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder="auto-generated"
                className="w-48"
              />
            </div>
            <Button onClick={handleCreate} isLoading={isCreating}>
              Створити
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Логотип</th>
              <th className="px-4 py-3 text-left font-medium">Назва</th>
              <th className="px-4 py-3 text-left font-medium">Slug</th>
              <th className="px-4 py-3 text-center font-medium">Видимий</th>
              <th className="px-4 py-3 text-center font-medium">Порядок</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                    {b.logoPath ? (
                      <Image
                        src={b.logoPath}
                        alt={b.name}
                        fill
                        sizes="40px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[8px] text-[var(--color-text-secondary)]">
                        —
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{b.slug}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${b.isVisible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {b.isVisible ? 'Так' : 'Ні'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                  {b.sortOrder}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(b)}>
                      Редагувати
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmDelete({ id: b.id, name: b.name })}
                      isLoading={isDeleting === b.id}
                    >
                      Видалити
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                >
                  Виробників не знайдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingId(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] bg-[var(--color-bg)] p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Редагувати виробника</h3>
            <div className="space-y-4">
              <Input
                label="Назва *"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <Input
                label="Slug"
                value={editForm.slug}
                onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                placeholder="auto-generated from name"
              />
              <div>
                <label className="mb-1 block text-sm font-medium">Опис</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  placeholder="Коротка інформація про виробника (показується на /brand/[slug])"
                />
              </div>

              {/* Logo upload */}
              <div>
                <label className="mb-1 block text-sm font-medium">Логотип</label>
                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    {editForm.logoPath ? (
                      <Image
                        src={editForm.logoPath}
                        alt="logo"
                        fill
                        sizes="80px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-[var(--color-text-secondary)]">
                        нема
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      isLoading={isUploading}
                    >
                      {editForm.logoPath ? 'Замінити' : 'Завантажити'}
                    </Button>
                    {editForm.logoPath && (
                      <button
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, logoPath: '' }))}
                        className="text-xs text-[var(--color-danger)] hover:underline"
                      >
                        Видалити
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Input
                  label="Порядок"
                  type="number"
                  value={String(editForm.sortOrder)}
                  onChange={(e) =>
                    setEditForm({ ...editForm, sortOrder: Number(e.target.value) || 0 })
                  }
                  className="w-32"
                />
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.isVisible}
                    onChange={(e) => setEditForm({ ...editForm, isVisible: e.target.checked })}
                    className="accent-[var(--color-primary)]"
                  />
                  Показувати на сайті
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Скасувати
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                Зберегти
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Видалення виробника"
        message={`Видалити "${confirmDelete?.name}"? Якщо у виробника є товари — бренд просто відв'яжеться від них; інакше буде стертий.`}
        confirmText="Так, видалити"
      />
    </div>
  );
}
