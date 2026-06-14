'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Format = 'xlsx' | 'csv' | 'yml' | 'xml_1c';
type AuthType = 'none' | 'basic' | 'bearer';
type SyncMode = 'catalog_import' | 'price_stock';
type MarkupType = 'percent' | 'fixed';
type Fulfillment = 'own_stock' | 'dropship';
type StockPolicy = 'hide' | 'backorder';

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
  syncMode: SyncMode;
  markupType: MarkupType;
  markupValue: number | string;
  fulfillment: Fulfillment;
  stockPolicy: StockPolicy;
  minPrice: number | string | null;
  notifyTelegramChatId: string | null;
  notifyEmail: string | null;
  feedCurrencyRate: number | string;
  reserveAware: boolean;
  zeroMissing: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  variantsCreated?: number;
  variantsUpdated?: number;
  importLogId?: number;
  // price_stock mode extras
  mode?: SyncMode;
  matched?: number;
  unmatched?: number;
  priceChanged?: number;
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
  syncMode: SyncMode;
  markupType: MarkupType;
  markupValue: string;
  fulfillment: Fulfillment;
  stockPolicy: StockPolicy;
  minPrice: string;
  notifyTelegramChatId: string;
  notifyEmail: string;
  feedCurrencyRate: string;
  reserveAware: boolean;
  zeroMissing: boolean;
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
  syncMode: 'catalog_import',
  markupType: 'percent',
  markupValue: '0',
  fulfillment: 'own_stock',
  stockPolicy: 'hide',
  minPrice: '',
  notifyTelegramChatId: '',
  notifyEmail: '',
  feedCurrencyRate: '1',
  reserveAware: false,
  zeroMissing: false,
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
      syncMode: c.syncMode ?? 'catalog_import',
      markupType: c.markupType ?? 'percent',
      markupValue: c.markupValue != null ? String(c.markupValue) : '0',
      fulfillment: c.fulfillment ?? 'own_stock',
      stockPolicy: c.stockPolicy ?? 'hide',
      minPrice: c.minPrice != null ? String(c.minPrice) : '',
      notifyTelegramChatId: c.notifyTelegramChatId ?? '',
      notifyEmail: c.notifyEmail ?? '',
      feedCurrencyRate: c.feedCurrencyRate != null ? String(c.feedCurrencyRate) : '1',
      reserveAware: c.reserveAware ?? false,
      zeroMissing: c.zeroMissing ?? false,
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.feedUrl.trim()) {
      toast.error(t('nameUrlRequired'));
      return;
    }
    const markupNum = Number(form.markupValue);
    const minPriceNum = form.minPrice.trim() === '' ? null : Number(form.minPrice);
    if (form.syncMode === 'price_stock') {
      if (!Number.isFinite(markupNum) || markupNum < 0) {
        toast.error('Націнка має бути числом ≥ 0');
        return;
      }
      if (minPriceNum != null && (!Number.isFinite(minPriceNum) || minPriceNum <= 0)) {
        toast.error('Мін. ціна має бути додатнім числом');
        return;
      }
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
      syncMode: form.syncMode,
      markupType: form.markupType,
      markupValue: Number.isFinite(markupNum) && markupNum >= 0 ? markupNum : 0,
      fulfillment: form.fulfillment,
      stockPolicy: form.stockPolicy,
      minPrice: minPriceNum,
      notifyTelegramChatId: form.notifyTelegramChatId.trim() || null,
      notifyEmail: form.notifyEmail.trim() || null,
      feedCurrencyRate: Number(form.feedCurrencyRate) > 0 ? Number(form.feedCurrencyRate) : 1,
      reserveAware: form.reserveAware,
      zeroMissing: form.zeroMissing,
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
        if (res.data.mode === 'price_stock') {
          // Consignment sync — report matched/updated/unmatched, not create/variants.
          toast.success(
            `${prefix}: оновлено ${res.data.updated}, ціна змінилась у ${res.data.priceChanged ?? 0}, без пари ${res.data.unmatched ?? 0}`,
          );
        } else {
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
        }
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
        <div className="flex items-center gap-2">
          <Link
            href="/admin/supplier-channels/reconciliation"
            className="text-xs text-[var(--color-primary)] underline"
          >
            Звіт розрахунків
          </Link>
          <Button size="sm" onClick={openNew}>
            {t('addChannel')}
          </Button>
        </div>
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
                      <Link
                        href={`/admin/supplier-channels/${c.id}/logs`}
                        className="inline-flex h-8 items-center rounded-[var(--radius)] border border-[var(--color-border)] px-2 text-xs"
                        title="Історія синхронізацій"
                      >
                        Лог
                      </Link>
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

            {/* Режим роботи каналу */}
            <div className="sm:col-span-2 border-t border-[var(--color-border)] pt-3">
              <label className="mb-1 block text-sm font-medium">Режим роботи</label>
              <select
                value={form.syncMode}
                onChange={(e) => setForm({ ...form, syncMode: e.target.value as SyncMode })}
                className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm sm:w-auto"
              >
                <option value="catalog_import">
                  Імпорт каталогу (створює/оновлює товари за ціною фіда)
                </option>
                <option value="price_stock">
                  Консигнація / дропшип (ціна+залишок прив’язаних товарів)
                </option>
              </select>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {form.syncMode === 'price_stock'
                  ? 'Фід керує закупівельною ціною (+націнка) та залишком лише прив’язаних товарів. Прив’яжи товари кнопкою «Прив’язати товари».'
                  : 'Фід створює/оновлює товари за ціною з фіда напряму, без націнки.'}
              </p>
            </div>

            {form.syncMode === 'price_stock' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Тип націнки</label>
                  <select
                    value={form.markupType}
                    onChange={(e) => setForm({ ...form, markupType: e.target.value as MarkupType })}
                    className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                  >
                    <option value="percent">Відсоток (%)</option>
                    <option value="fixed">Фіксована сума (₴)</option>
                  </select>
                </div>
                <Input
                  label={form.markupType === 'percent' ? 'Націнка, %' : 'Націнка, ₴'}
                  type="number"
                  value={form.markupValue}
                  onChange={(e) => setForm({ ...form, markupValue: e.target.value })}
                  placeholder="30"
                />
                <div>
                  <label className="mb-1 block text-sm font-medium">Відвантаження</label>
                  <select
                    value={form.fulfillment}
                    onChange={(e) =>
                      setForm({ ...form, fulfillment: e.target.value as Fulfillment })
                    }
                    className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                  >
                    <option value="own_stock">Зі свого складу (консигнація)</option>
                    <option value="dropship">Дропшип (відправляє постачальник)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Залишок 0</label>
                  <select
                    value={form.stockPolicy}
                    onChange={(e) =>
                      setForm({ ...form, stockPolicy: e.target.value as StockPolicy })
                    }
                    className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                  >
                    <option value="hide">Ховати товар</option>
                    <option value="backorder">Лишати «під замовлення»</option>
                  </select>
                </div>
                <Input
                  label="Мін. ціна, ₴ (необов’язково)"
                  type="number"
                  value={form.minPrice}
                  onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
                  placeholder="—"
                />
                <Input
                  label="Курс валюти фіда → ₴ (1 = фід у грн)"
                  type="number"
                  value={form.feedCurrencyRate}
                  onChange={(e) => setForm({ ...form, feedCurrencyRate: e.target.value })}
                  placeholder="1"
                />
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.reserveAware}
                    onChange={(e) => setForm({ ...form, reserveAware: e.target.checked })}
                    className="accent-[var(--color-primary)]"
                  />
                  Фід НЕ зменшує залишок на наші замовлення (резервувати)
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.zeroMissing}
                    onChange={(e) => setForm({ ...form, zeroMissing: e.target.checked })}
                    className="accent-[var(--color-primary)]"
                  />
                  Обнуляти залишок товарів, відсутніх у фіді
                </label>
                {form.fulfillment === 'dropship' && (
                  <>
                    <Input
                      label="Telegram chat ID постачальника"
                      value={form.notifyTelegramChatId}
                      onChange={(e) => setForm({ ...form, notifyTelegramChatId: e.target.value })}
                      placeholder="напр. 123456789"
                    />
                    <Input
                      label="Email постачальника (запасний канал)"
                      value={form.notifyEmail}
                      onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })}
                      placeholder="supplier@example.com"
                    />
                  </>
                )}
                {editingId !== 'new' && (
                  <div className="flex flex-wrap gap-4 sm:col-span-2">
                    <Link
                      href={`/admin/supplier-channels/${editingId}/import`}
                      className="text-sm text-[var(--color-primary)] underline"
                    >
                      → Прив’язати товари (перший імпорт)
                    </Link>
                    <Link
                      href={`/admin/supplier-channels/${editingId}/products`}
                      className="text-sm text-[var(--color-primary)] underline"
                    >
                      → Прив’язані товари / націнка
                    </Link>
                  </div>
                )}
              </>
            )}
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
