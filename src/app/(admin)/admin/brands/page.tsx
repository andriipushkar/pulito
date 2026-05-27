'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoPath: string | null;
  website: string | null;
  country: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  nameEn: string | null;
  descriptionEn: string | null;
  seoTitleEn: string | null;
  seoDescriptionEn: string | null;
  isVisible: boolean;
  sortOrder: number;
  version?: number;
  _count?: { products: number };
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
    website: '',
    country: '',
    seoTitle: '',
    seoDescription: '',
    nameEn: '',
    descriptionEn: '',
    seoTitleEn: '',
    seoDescriptionEn: '',
    isVisible: true,
    sortOrder: 0,
  });
  const [editSnapshot, setEditSnapshot] = useState<typeof editForm | null>(null);
  const isEditDirty = useMemo(
    () => editSnapshot !== null && JSON.stringify(editForm) !== JSON.stringify(editSnapshot),
    [editForm, editSnapshot],
  );
  const guardEdit = useUnsavedChangesGuard(isEditDirty);
  const closeEdit = () =>
    guardEdit(() => {
      setEditingId(null);
      setEditSnapshot(null);
    });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadBrands = useCallback(() => {
    setIsLoading(true);
    apiClient
      .get<AdminBrand[]>('/api/v1/admin/brands?includeHidden=true')
      .then((res) => {
        if (res.success && res.data) setBrands(res.data);
        else toast.error(res.error || 'Не вдалося завантажити торгових марок');
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const handleEdit = (b: AdminBrand) => {
    setEditingId(b.id);
    const snapshot = {
      name: b.name,
      slug: b.slug,
      description: b.description || '',
      logoPath: b.logoPath || '',
      website: b.website || '',
      country: b.country || '',
      seoTitle: b.seoTitle || '',
      seoDescription: b.seoDescription || '',
      nameEn: b.nameEn || '',
      descriptionEn: b.descriptionEn || '',
      seoTitleEn: b.seoTitleEn || '',
      seoDescriptionEn: b.seoDescriptionEn || '',
      isVisible: b.isVisible,
      sortOrder: b.sortOrder,
    };
    setEditForm(snapshot);
    setEditSnapshot(snapshot);
  };

  const handleSave = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const current = brands.find((b) => b.id === editingId);
      const res = await apiClient.put<AdminBrand>(`/api/v1/admin/brands/${editingId}`, {
        name: editForm.name,
        slug: editForm.slug || undefined,
        description: editForm.description || null,
        logoPath: editForm.logoPath || null,
        website: editForm.website.trim() || null,
        country: editForm.country.trim() || null,
        seoTitle: editForm.seoTitle.trim() || null,
        seoDescription: editForm.seoDescription.trim() || null,
        nameEn: editForm.nameEn.trim() || null,
        descriptionEn: editForm.descriptionEn.trim() || null,
        seoTitleEn: editForm.seoTitleEn.trim() || null,
        seoDescriptionEn: editForm.seoDescriptionEn.trim() || null,
        isVisible: editForm.isVisible,
        sortOrder: Number(editForm.sortOrder) || 0,
        version: current?.version,
      });
      if (res.success) {
        toast.success('Торгової марки оновлено');
        setEditingId(null);
        setEditSnapshot(null);
        loadBrands();
      } else if (res.statusCode === 409) {
        toast.error(res.error || 'Торгової марки змінено іншим адміністратором', {
          duration: 12000,
          action: {
            label: 'Оновити з сервера',
            onClick: () => {
              loadBrands();
              setEditingId(null);
              setEditSnapshot(null);
              toast.success('Оновлено — відкрийте знову і повторіть редагування');
            },
          },
        });
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
      toast.error('Введіть назву торгової марки');
      return;
    }
    setIsCreating(true);
    try {
      const res = await apiClient.post<AdminBrand>('/api/v1/admin/brands', {
        name,
        slug: createForm.slug.trim() || undefined,
      });
      if (res.success) {
        toast.success('Торгової марки створено');
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
        toast.success(res.data?.message || 'Торгової марки видалено');
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  if (isLoading) {
    return <AdminTableSkeleton rows={8} columns={7} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          Торгові марки{' '}
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
          <p className="mb-3 text-sm font-semibold">Новий торгова марка</p>
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
              <th className="px-4 py-3 text-center font-medium">Товарів</th>
              <th className="px-4 py-3 text-center font-medium">Видимий</th>
              <th className="px-4 py-3 text-center font-medium">Порядок</th>
              <th className="px-4 py-3 text-right font-medium">Дії</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((b) => (
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
                  {b._count ? (
                    <a
                      href={`/admin/products?brandId=${b.id}`}
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        b._count.products === 0
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:underline'
                      }`}
                      title={`Переглянути ${b._count.products} товарів`}
                    >
                      {b._count.products}
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                  )}
                </td>
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
                    <a
                      href={`/brand/${b.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                      title="Переглянути на сайті"
                    >
                      ↗
                    </a>
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
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
                    <span className="text-3xl" aria-hidden="true">
                      🏭
                    </span>
                    <p className="text-sm font-medium">
                      {search ? 'Торгових марок не знайдено' : 'Торгових марок ще немає'}
                    </p>
                    {search ? (
                      <button
                        onClick={() => setSearch('')}
                        className="text-xs text-[var(--color-primary)] hover:underline"
                      >
                        Скинути пошук
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
                      >
                        + Створити торгової марки
                      </button>
                    )}
                  </div>
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
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius)] bg-[var(--color-bg)] p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Редагувати торгової марки</h3>
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
                  placeholder="Коротка інформація про торгової марки (показується на /brand/[slug])"
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

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Веб-сайт торгової марки"
                  type="url"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  placeholder="https://brand-website.com"
                />
                <Input
                  label="Країна походження"
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  placeholder="Україна"
                />
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                  SEO
                </p>
                <div className="space-y-3">
                  <div>
                    <Input
                      label="SEO Title"
                      value={editForm.seoTitle}
                      onChange={(e) => setEditForm({ ...editForm, seoTitle: e.target.value })}
                      maxLength={70}
                    />
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {editForm.seoTitle.length}/70
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">SEO Description</label>
                    <textarea
                      value={editForm.seoDescription}
                      onChange={(e) => setEditForm({ ...editForm, seoDescription: e.target.value })}
                      rows={2}
                      maxLength={160}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                    />
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {editForm.seoDescription.length}/160
                    </p>
                  </div>
                </div>
              </div>

              <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase">
                  <span className="mr-2 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    EN
                  </span>
                  Англійський переклад (опційно)
                </summary>
                <div className="mt-3 space-y-3">
                  <Input
                    label="Name (EN)"
                    value={editForm.nameEn}
                    onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium">Description (EN)</label>
                    <textarea
                      value={editForm.descriptionEn}
                      onChange={(e) => setEditForm({ ...editForm, descriptionEn: e.target.value })}
                      rows={3}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <Input
                    label="SEO Title (EN)"
                    value={editForm.seoTitleEn}
                    onChange={(e) => setEditForm({ ...editForm, seoTitleEn: e.target.value })}
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium">SEO Description (EN)</label>
                    <textarea
                      value={editForm.seoDescriptionEn}
                      onChange={(e) =>
                        setEditForm({ ...editForm, seoDescriptionEn: e.target.value })
                      }
                      rows={2}
                      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>
              </details>

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
              <Button variant="outline" onClick={closeEdit}>
                Скасувати
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                Зберегти
              </Button>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">
            Сторінка {currentPage} з {totalPages} · {filtered.length} торгових марок
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              ← Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Вперед →
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Видалення торгової марки"
        message={`Видалити "${confirmDelete?.name}"? Якщо у торгової марки є товари — бренд просто відв'яжеться від них; інакше буде стертий.`}
        confirmText="Так, видалити"
      />
    </div>
  );
}
