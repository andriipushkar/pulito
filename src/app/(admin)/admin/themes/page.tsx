'use client';

import { useEffect, useState } from 'react';
import { apiClient, getAccessToken } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface Theme {
  id: number;
  folderName: string;
  displayName: string;
  description: string | null;
  version: string | null;
  author: string | null;
  isActive: boolean;
  customSettings: Record<string, string> | null;
  activatedAt: string | null;
}

const COLOR_VARS = [
  { key: '--color-primary', label: 'Основний' },
  { key: '--color-primary-light', label: 'Основний (світлий)' },
  { key: '--color-primary-dark', label: 'Основний (темний)' },
  { key: '--color-secondary', label: 'Вторинний' },
  { key: '--color-accent', label: 'Акцент' },
  { key: '--color-danger', label: 'Небезпека' },
  { key: '--color-bg', label: 'Фон' },
  { key: '--color-bg-secondary', label: 'Фон вторинний' },
  { key: '--color-text', label: 'Текст' },
  { key: '--color-text-secondary', label: 'Текст вторинний' },
  { key: '--color-border', label: 'Бордер' },
  { key: '--color-cta', label: 'CTA кнопка' },
  { key: '--color-in-stock', label: 'В наявності' },
  { key: '--color-out-of-stock', label: 'Немає в наявності' },
];

function ThemePreview({ colors }: { colors: Record<string, string> }) {
  const style = Object.entries(colors).reduce((acc, [k, v]) => {
    acc[k as string] = v;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border-2 border-dashed border-[var(--color-border)] p-4" style={style}>
      <div className="mb-3 flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: colors['--color-bg'] || '#fff' }}>
        <span className="text-lg font-bold" style={{ color: colors['--color-primary'] || '#2563eb' }}>Порошок</span>
        <div className="ml-auto flex gap-2">
          <span className="rounded px-3 py-1 text-xs text-white" style={{ backgroundColor: colors['--color-primary'] || '#2563eb' }}>Каталог</span>
          <span className="rounded px-3 py-1 text-xs" style={{ color: colors['--color-text-secondary'] || '#6b7280', borderWidth: 1, borderColor: colors['--color-border'] || '#e5e7eb' }}>Акції</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['Товар 1', 'Товар 2', 'Товар 3'].map((name) => (
          <div key={name} className="rounded-lg p-2" style={{ backgroundColor: colors['--color-bg-secondary'] || '#f9fafb', borderWidth: 1, borderColor: colors['--color-border'] || '#e5e7eb' }}>
            <div className="mb-2 aspect-square rounded" style={{ backgroundColor: colors['--color-border'] || '#e5e7eb' }} />
            <p className="text-xs font-medium" style={{ color: colors['--color-text'] || '#111827' }}>{name}</p>
            <p className="text-xs" style={{ color: colors['--color-text-secondary'] || '#6b7280' }}>Код: A001</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: colors['--color-primary'] || '#2563eb' }}>125.00 ₴</span>
              <span className="text-[10px]" style={{ color: colors['--color-in-stock'] || '#16a34a' }}>В наявності</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="rounded px-4 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: colors['--color-primary'] || '#2563eb' }}>Кнопка CTA</button>
        <button className="rounded px-4 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: colors['--color-danger'] || '#dc2626' }}>Небезпека</button>
      </div>
    </div>
  );
}

export default function AdminThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadThemes = () => {
    apiClient.get<Theme[]>('/api/v1/admin/themes').then((res) => {
      if (res.success && res.data) setThemes(res.data);
    }).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadThemes(); }, []);

  const activateTheme = async (id: number) => {
    await apiClient.put(`/api/v1/admin/themes/${id}/activate`, {});
    loadThemes();
  };

  const startEdit = (theme: Theme) => {
    setEditingId(theme.id);
    setColors((theme.customSettings as Record<string, string>) || {});
  };

  const saveColors = async () => {
    if (!editingId) return;
    await apiClient.put(`/api/v1/admin/themes/${editingId}`, { customSettings: colors });
    setEditingId(null);
    loadThemes();
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      setUploadStatus('Будь ласка, завантажте ZIP-файл');
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/themes', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        setUploadStatus('Тему успішно завантажено');
        loadThemes();
      } else {
        const data = await res.json().catch(() => null);
        setUploadStatus(data?.message || 'Помилка завантаження теми');
      }
    } catch {
      setUploadStatus('Помилка мережі');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Теми оформлення</h2>
        <label className="cursor-pointer rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]">
          {isUploading ? 'Завантаження...' : 'Завантажити ZIP'}
          <input type="file" accept=".zip" onChange={handleZipUpload} className="hidden" disabled={isUploading} />
        </label>
      </div>

      {uploadStatus && (
        <div className={`mb-4 rounded-[var(--radius)] px-4 py-2 text-sm ${uploadStatus.includes('успішно') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {uploadStatus}
        </div>
      )}

      <div className="space-y-4">
        {themes.map((t) => (
          <div key={t.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t.displayName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{t.description || t.folderName} {t.version ? `v${t.version}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(t)}>Кольори</Button>
                {!t.isActive ? (
                  <Button size="sm" onClick={() => activateTheme(t.id)}>Активувати</Button>
                ) : (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-700">Активна</span>
                )}
              </div>
            </div>

            {editingId === t.id && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {COLOR_VARS.map((cv) => (
                    <div key={cv.key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colors[cv.key] || '#000000'}
                        onChange={(e) => setColors((prev) => ({ ...prev, [cv.key]: e.target.value }))}
                        className="h-8 w-8 rounded border"
                      />
                      <span className="text-xs">{cv.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={saveColors}>Зберегти</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
                    {showPreview ? 'Сховати прев\'ю' : 'Прев\'ю'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Скасувати</Button>
                </div>
                {showPreview && <ThemePreview colors={colors} />}
              </div>
            )}
          </div>
        ))}

        {themes.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">Тем не знайдено</div>
        )}
      </div>
    </div>
  );
}
