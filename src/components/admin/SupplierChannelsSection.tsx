'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Format = 'xlsx' | 'csv' | 'yml' | 'xml_1c';
type AuthType = 'none' | 'basic' | 'bearer';

interface Channel {
  id: number;
  name: string;
  feedUrl: string;
  format: Format;
  authType: AuthType;
  authUsername: string | null;
  authPassword: string | null;
  authToken: string | null;
  isActive: boolean;
  scheduleCron: string | null;
  lastSyncAt: string | null;
  lastImportLogId: number | null;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  variantsCreated?: number;
  variantsUpdated?: number;
  importLogId?: number;
}

interface FormState {
  name: string;
  feedUrl: string;
  format: Format;
  authType: AuthType;
  authUsername: string;
  authPassword: string;
  authToken: string;
  isActive: boolean;
  scheduleCron: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  feedUrl: '',
  format: 'yml',
  authType: 'none',
  authUsername: '',
  authPassword: '',
  authToken: '',
  isActive: true,
  scheduleCron: '',
};

// Common cron presets — picking from a dropdown is faster than typing 5-field
// cron expressions, and avoids the "min/hour/dom/mon/dow" ordering gotcha.
const CRON_PRESETS = [
  { value: '', label: 'Лише вручну' },
  { value: '0 * * * *', label: 'Щогодини' },
  { value: '0 */3 * * *', label: 'Кожні 3 години' },
  { value: '0 8 * * *', label: 'Щодня о 08:00' },
  { value: '0 8 * * 1', label: 'Щопонеділка о 08:00' },
  { value: '0 0 1 * *', label: 'Щомісяця 1-го о 00:00' },
];

export default function SupplierChannelsSection() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const load = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<Channel[]>('/api/v1/admin/supplier-channels');
      if (res.success && res.data) setChannels(res.data);
    } catch {
      toast.error('Не вдалося завантажити канали');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
  };

  const openEdit = (c: Channel) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      feedUrl: c.feedUrl,
      format: c.format,
      authType: c.authType,
      authUsername: c.authUsername ?? '',
      authPassword: c.authPassword ?? '', // already redacted "***" from server
      authToken: c.authToken ?? '',
      isActive: c.isActive,
      scheduleCron: c.scheduleCron ?? '',
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.feedUrl.trim()) {
      toast.error('Назва і URL обов\'язкові');
      return;
    }
    const payload = {
      name: form.name.trim(),
      feedUrl: form.feedUrl.trim(),
      format: form.format,
      authType: form.authType,
      authUsername: form.authUsername.trim() || null,
      authPassword: form.authPassword || null,
      authToken: form.authToken || null,
      isActive: form.isActive,
      scheduleCron: form.scheduleCron.trim() || null,
    };
    try {
      const res = editingId === 'new'
        ? await apiClient.post<Channel>('/api/v1/admin/supplier-channels', payload)
        : await apiClient.put<Channel>(`/api/v1/admin/supplier-channels/${editingId}`, payload);
      if (res.success) {
        toast.success(editingId === 'new' ? 'Канал створено' : 'Канал оновлено');
        setEditingId(null);
        load();
      } else {
        toast.error(res.error || 'Помилка');
      }
    } catch {
      toast.error('Помилка мережі');
    }
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(`Видалити канал "${name}"?`)) return;
    try {
      const res = await apiClient.delete(`/api/v1/admin/supplier-channels/${id}`);
      if (res.success) {
        toast.success('Канал видалено');
        load();
      } else {
        toast.error(res.error || 'Помилка');
      }
    } catch {
      toast.error('Помилка мережі');
    }
  };

  const sync = async (id: number, dryRun: boolean) => {
    setSyncingId(id);
    try {
      const res = await apiClient.post<SyncResult>(
        `/api/v1/admin/supplier-channels/${id}/sync${dryRun ? '?dryRun=1' : ''}`,
      );
      if (res.success && res.data) {
        const prefix = dryRun ? 'Симуляція (БД не змінено)' : 'Синхронізовано';
        const variants =
          (res.data.variantsCreated ?? 0) + (res.data.variantsUpdated ?? 0) > 0
            ? `, варіантів: ${(res.data.variantsCreated ?? 0) + (res.data.variantsUpdated ?? 0)}`
            : '';
        toast.success(
          `${prefix}: створено ${res.data.created}, оновлено ${res.data.updated}, пропущено ${res.data.skipped}${variants}`,
        );
        if (!dryRun) load();
      } else {
        toast.error(res.error || 'Не вдалося синхронізувати');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Канали постачальників</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Тягни прайс з URL постачальника (XLSX, CSV, YML, 1С XML) і запускай імпорт натиском кнопки
          </p>
        </div>
        <Button size="sm" onClick={openNew}>+ Додати канал</Button>
      </div>

      {isLoading && <div className="text-sm text-[var(--color-text-secondary)]">Завантаження…</div>}

      {!isLoading && channels.length === 0 && editingId !== 'new' && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Каналів немає. Додай URL постачальника щоб імпортувати прайс одним кліком.
        </p>
      )}

      {channels.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-2 py-2 text-left">Назва</th>
                <th className="px-2 py-2 text-left">Формат</th>
                <th className="px-2 py-2 text-left">Остання синхр.</th>
                <th className="px-2 py-2 text-center">Активн.</th>
                <th className="px-2 py-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-2 py-2 font-medium">{c.name}</td>
                  <td className="px-2 py-2 uppercase">{c.format}</td>
                  <td className="px-2 py-2 text-xs text-[var(--color-text-secondary)]">
                    {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString('uk-UA') : '—'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Так' : 'Ні'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sync(c.id, true)}
                        disabled={syncingId === c.id || !c.isActive}
                        title="Симуляція без запису в БД"
                      >
                        Перевір
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => sync(c.id, false)}
                        disabled={syncingId === c.id || !c.isActive}
                      >
                        {syncingId === c.id ? '…' : 'Синхр.'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                        ✏️
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(c.id, c.name)}>
                        🗑
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingId !== null && (
        <div className="mt-4 rounded-md border border-[var(--color-border)] p-4">
          <h4 className="mb-3 text-sm font-semibold">
            {editingId === 'new' ? 'Новий канал' : `Редагувати канал #${editingId}`}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Назва"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Постачальник А"
            />
            <Input
              label="URL фіда"
              value={form.feedUrl}
              onChange={(e) => setForm({ ...form, feedUrl: e.target.value })}
              placeholder="https://supplier.example/price.yml"
            />
            <div>
              <label className="mb-1 block text-sm font-medium">Формат</label>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value as Format })}
                className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
              >
                <option value="xlsx">XLSX (Excel)</option>
                <option value="csv">CSV</option>
                <option value="yml">YML (Yandex Market)</option>
                <option value="xml_1c">XML / 1С</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Тип авторизації</label>
              <select
                value={form.authType}
                onChange={(e) => setForm({ ...form, authType: e.target.value as AuthType })}
                className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
              >
                <option value="none">Без авторизації</option>
                <option value="basic">Basic (логін + пароль)</option>
                <option value="bearer">Bearer Token</option>
              </select>
            </div>
            {form.authType === 'basic' && (
              <>
                <Input
                  label="Логін"
                  value={form.authUsername}
                  onChange={(e) => setForm({ ...form, authUsername: e.target.value })}
                />
                <Input
                  label="Пароль"
                  type="password"
                  value={form.authPassword}
                  onChange={(e) => setForm({ ...form, authPassword: e.target.value })}
                  placeholder={editingId !== 'new' ? '*** (залиш порожнім — не змінювати)' : ''}
                />
              </>
            )}
            {form.authType === 'bearer' && (
              <Input
                label="Token"
                value={form.authToken}
                onChange={(e) => setForm({ ...form, authToken: e.target.value })}
                placeholder={editingId !== 'new' ? '*** (залиш порожнім — не змінювати)' : ''}
              />
            )}
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              Активний
            </label>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Автозапуск (cron)</label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={
                    CRON_PRESETS.some((p) => p.value === form.scheduleCron)
                      ? form.scheduleCron
                      : 'custom'
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'custom') return; // keep custom value
                    setForm({ ...form, scheduleCron: v });
                  }}
                  className="h-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                >
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value || 'manual'} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">Власний cron-вираз</option>
                </select>
                <input
                  type="text"
                  value={form.scheduleCron}
                  onChange={(e) => setForm({ ...form, scheduleCron: e.target.value })}
                  placeholder="* * * * *"
                  className="h-10 flex-1 min-w-[180px] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-mono text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Формат: <code>хвилина година день місяць день_тижня</code>. Порожнє = тільки кнопка «Синхр.»
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
              Скасувати
            </Button>
            <Button size="sm" onClick={save}>Зберегти</Button>
          </div>
        </div>
      )}
    </div>
  );
}
