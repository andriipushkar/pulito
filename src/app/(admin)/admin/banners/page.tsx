'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient, getAccessToken } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { Trash, Check, Close } from '@/components/icons';

interface Banner {
  id: number;
  title: string | null;
  subtitle: string | null;
  imageDesktop: string;
  imageMobile: string | null;
  buttonLink: string | null;
  buttonText: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface EditForm {
  title: string;
  subtitle: string;
  buttonLink: string;
  buttonText: string;
  sortOrder: number;
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', subtitle: '', buttonLink: '', buttonText: '', sortOrder: 0 });
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  const loadBanners = useCallback(() => {
    apiClient
      .get<Banner[]>('/api/v1/admin/banners')
      .then((res) => {
        if (res.success && res.data) setBanners(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadBanners(); }, [loadBanners]);

  const toggleActive = async (id: number, isActive: boolean) => {
    await apiClient.put(`/api/v1/admin/banners/${id}`, { isActive: !isActive });
    loadBanners();
  };

  const deleteBanner = async (id: number) => {
    if (!confirm('Видалити банер?')) return;
    await apiClient.delete(`/api/v1/admin/banners/${id}`);
    loadBanners();
  };

  const startEdit = (b: Banner) => {
    setEditingId(b.id);
    setEditForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      buttonLink: b.buttonLink || '',
      buttonText: b.buttonText || '',
      sortOrder: b.sortOrder,
    });
  };

  const saveEdit = async (id: number) => {
    await apiClient.put(`/api/v1/admin/banners/${id}`, editForm);
    setEditingId(null);
    loadBanners();
  };

  const handleImageUpload = async (bannerId: number, file: File) => {
    setUploading(bannerId);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/admin/banners/${bannerId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      if (res.ok) loadBanners();
    } finally {
      setUploading(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, bannerId: number) => {
    e.dataTransfer.setData('bannerId', String(bannerId));
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = Number(e.dataTransfer.getData('bannerId'));
    if (draggedId === targetId) return;

    const newBanners = [...banners];
    const dragIndex = newBanners.findIndex((b) => b.id === draggedId);
    const targetIndex = newBanners.findIndex((b) => b.id === targetId);
    const [dragged] = newBanners.splice(dragIndex, 1);
    newBanners.splice(targetIndex, 0, dragged);

    setBanners(newBanners);

    const orderedIds = newBanners.map((b) => b.id);
    await apiClient.put('/api/v1/admin/banners/reorder', { orderedIds });
    loadBanners();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Банери / Слайдер</h2>
        <Button onClick={() => {
          apiClient.post('/api/v1/admin/banners', { title: 'Новий банер', imageDesktop: '' }).then(() => loadBanners());
        }}>+ Додати</Button>
      </div>

      <div className="space-y-3">
        {banners.map((b) => (
          <div
            key={b.id}
            draggable
            onDragStart={(e) => handleDragStart(e, b.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(b.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => handleDrop(e, b.id)}
            className={`rounded-[var(--radius)] border bg-[var(--color-bg)] p-4 transition-colors ${
              dragOverId === b.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-[var(--color-border)]'
            }`}
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                {b.imageDesktop ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={b.imageDesktop} alt={b.title || 'Банер'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-secondary)]">Немає зобр.</div>
                )}
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 text-xs text-transparent transition-all hover:bg-black/40 hover:text-white">
                  {uploading === b.id ? '...' : 'Завантажити'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(b.id, file);
                    }}
                  />
                </label>
              </div>

              {editingId === b.id ? (
                /* Inline edit */
                <div className="flex-1 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      placeholder="Назва"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Підзаголовок"
                      value={editForm.subtitle}
                      onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Посилання"
                      value={editForm.buttonLink}
                      onChange={(e) => setEditForm({ ...editForm, buttonLink: e.target.value })}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Текст кнопки"
                      value={editForm.buttonText}
                      onChange={(e) => setEditForm({ ...editForm, buttonText: e.target.value })}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Порядок"
                      value={editForm.sortOrder}
                      onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) })}
                      className="w-24 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    />
                    <button onClick={() => saveEdit(b.id)} className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"><Close size={16} /></button>
                  </div>
                </div>
              ) : (
                /* Display */
                <div className="flex flex-1 items-center gap-4">
                  <span className="text-sm text-[var(--color-text-secondary)]">#{b.sortOrder}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{b.title || 'Без назви'}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{b.buttonLink || 'Без посилання'}</p>
                  </div>
                  <button onClick={() => startEdit(b)} className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]">Редагувати</button>
                  <button onClick={() => toggleActive(b.id, b.isActive)} className={`rounded-full px-3 py-1 text-xs ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {b.isActive ? 'Активний' : 'Вимкнено'}
                  </button>
                  <button onClick={() => deleteBanner(b.id)} className="p-1 text-[var(--color-danger)]"><Trash size={16} /></button>
                </div>
              )}
            </div>
          </div>
        ))}

        {banners.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">Банерів немає</div>
        )}
      </div>
    </div>
  );
}
