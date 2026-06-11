'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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

export default function SupplierChannelsSection() {
  const t = useTranslations('admin.supplierChannelsSection');
  // Common cron presets — picking from a dropdown is faster than typing 5-field
  // cron expressions, and avoids the "min/hour/dom/mon/dow" ordering gotcha.
  const CRON_PRESETS = useMemo(
    () => [
      { value: '', label: t('cronManual') },
      { value: '0 * * * *', label: t('cronHourly') },
      { value: '0 */3 * * *', label: t('cron3h') },
      { value: '0 8 * * *', label: t('cronDaily8') },
      { value: '0 8 * * 1', label: t('cronMon8') },
      { value: '0 0 1 * *', label: t('cronMonth1') },
    ],
    [t],
  );
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<Channel[]>('/api/v1/admin/supplier-channels');
      if (res.success && res.data) setChannels(res.data);
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

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
      toast.error(t('nameUrlRequired'));
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
      const res =
        editingId === 'new'
          ? await apiClient.post<Channel>('/api/v1/admin/supplier-channels', payload)
          : await apiClient.put<Channel>(`/api/v1/admin/supplier-channels/${editingId}`, payload);
      if (res.success) {
        toast.success(editingId === 'new' ? t('created') : t('updated'));
        setEditingId(null);
        load();
      } else {
        toast.error(res.error || t('error'));
      }
    } catch {
      toast.error(t('networkError'));
    }
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(t('confirmDelete', { name }))) return;
    try {
      const res = await apiClient.delete(`/api/v1/admin/supplier-channels/${id}`);
      if (res.success) {
        toast.success(t('deleted'));
        load();
      } else {
        toast.error(res.error || t('error'));
      }
    } catch {
      toast.error(t('networkError'));
    }
  };

  const sync = async (id: number, dryRun: boolean) => {
    setSyncingId(id);
    try {
      const res = await apiClient.post<SyncResult>(
        `/api/v1/admin/supplier-channels/${id}/sync${dryRun ? '?dryRun=1' : ''}`,
      );
      if (res.success && res.data) {
        const prefix = dryRun ? t('simPrefix') : t('syncedPrefix');
        const variantCount = (res.data.variantsCreated ?? 0) + (res.data.variantsUpdated ?? 0);
        const variants = variantCount > 0 ? t('variantsSuffix', { count: variantCount }) : '';
        toast.success(
          t('syncResult', {
            prefix,
            created: res.data.created,
            updated: res.data.updated,
            skipped: res.data.skipped,
            variants,
          }),
        );
        if (!dryRun) load();
      } else {
        toast.error(res.error || t('syncFailed'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t('title')}</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openNew}>
          {t('addChannel')}
        </Button>
      </div>

      {isLoading && (
        <div className="text-sm text-[var(--color-text-secondary)]">{t('loading')}</div>
      )}

      {!isLoading && channels.length === 0 && editingId !== 'new' && (
        <p className="text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
      )}

      {channels.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-2 py-2 text-left">{t('colName')}</th>
                <th className="px-2 py-2 text-left">{t('colFormat')}</th>
                <th className="px-2 py-2 text-left">{t('colLastSync')}</th>
                <th className="px-2 py-2 text-center">{t('colActive')}</th>
                <th className="px-2 py-2 text-right">{t('colActions')}</th>
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {c.isActive ? t('yes') : t('no')}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sync(c.id, true)}
                        disabled={syncingId === c.id || !c.isActive}
                        title={t('dryRunTitle')}
                      >
                        {t('check')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => sync(c.id, false)}
                        disabled={syncingId === c.id || !c.isActive}
                      >
                        {syncingId === c.id ? '…' : t('sync')}
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
            {editingId === 'new' ? t('newChannel') : t('editChannel', { id: editingId })}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('nameLabel')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
            <Input
              label={t('feedUrlLabel')}
              value={form.feedUrl}
              onChange={(e) => setForm({ ...form, feedUrl: e.target.value })}
              placeholder="https://supplier.example/price.yml"
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formatLabel')}</label>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value as Format })}
                className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
              >
                <option value="xlsx">{t('formatXlsx')}</option>
                <option value="csv">{t('formatCsv')}</option>
                <option value="yml">{t('formatYml')}</option>
                <option value="xml_1c">{t('formatXml1c')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('authTypeLabel')}</label>
              <select
                value={form.authType}
                onChange={(e) => setForm({ ...form, authType: e.target.value as AuthType })}
                className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
              >
                <option value="none">{t('authNone')}</option>
                <option value="basic">{t('authBasic')}</option>
                <option value="bearer">{t('authBearer')}</option>
              </select>
            </div>
            {form.authType === 'basic' && (
              <>
                <Input
                  label={t('loginLabel')}
                  value={form.authUsername}
                  onChange={(e) => setForm({ ...form, authUsername: e.target.value })}
                />
                <Input
                  label={t('passwordLabel')}
                  type="password"
                  value={form.authPassword}
                  onChange={(e) => setForm({ ...form, authPassword: e.target.value })}
                  placeholder={editingId !== 'new' ? t('secretPlaceholder') : ''}
                />
              </>
            )}
            {form.authType === 'bearer' && (
              <Input
                label={t('tokenLabel')}
                value={form.authToken}
                onChange={(e) => setForm({ ...form, authToken: e.target.value })}
                placeholder={editingId !== 'new' ? t('secretPlaceholder') : ''}
              />
            )}
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              {t('activeLabel')}
            </label>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">{t('cronLabel')}</label>
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
                  <option value="custom">{t('cronCustom')}</option>
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
                {t.rich('cronHint', { code: (chunks) => <code>{chunks}</code> })}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={save}>
              {t('save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
