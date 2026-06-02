'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface VolumeDiscount {
  id: number;
  productId: number | null;
  product?: { id: number; name: string; code: string } | null;
  categoryId: number | null;
  category?: { id: number; name: string } | null;
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number;
  discountType: string;
  isActive: boolean;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

const initialForm = {
  productId: '',
  categoryId: '',
  minQuantity: '',
  maxQuantity: '',
  discountPercent: '',
  discountType: 'percentage',
  isActive: true,
  priority: '0',
  startsAt: '',
  endsAt: '',
  stackPersonal: false,
  stackCoupon: false,
  stackLoyalty: false,
};

export default function AdminVolumeDiscountsPage() {
  const t = useTranslations('admin.volumeDiscountsPage');
  const DISCOUNT_TYPE_OPTIONS = [
    { value: 'percentage', label: t('typePercentage') },
    { value: 'fixed_amount', label: t('typeFixed') },
  ];
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const loadDiscounts = () => {
    setIsLoading(true);
    apiClient
      .get<VolumeDiscount[]>('/api/v1/admin/volume-discounts')
      .then((res) => {
        if (res.success && res.data) setDiscounts(res.data);
        else toast.error(t('loadError'));
      })
      .catch(() => toast.error(t('networkError')))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (d: VolumeDiscount) => {
    const stackable = (d as VolumeDiscount & { stackableWith?: string[] }).stackableWith ?? [];
    setForm({
      productId: d.productId ? String(d.productId) : '',
      categoryId: d.categoryId ? String(d.categoryId) : '',
      minQuantity: String(d.minQuantity),
      maxQuantity: d.maxQuantity ? String(d.maxQuantity) : '',
      discountPercent: String(d.discountPercent),
      discountType: d.discountType,
      isActive: d.isActive,
      priority: String(d.priority),
      startsAt: d.startsAt ? d.startsAt.slice(0, 16) : '',
      endsAt: d.endsAt ? d.endsAt.slice(0, 16) : '',
      stackPersonal: stackable.includes('personal_price'),
      stackCoupon: stackable.includes('coupon'),
      stackLoyalty: stackable.includes('loyalty'),
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const minQty = Number(form.minQuantity);
    const maxQty = form.maxQuantity ? Number(form.maxQuantity) : null;
    const discount = Number(form.discountPercent);

    if (!Number.isFinite(minQty) || minQty <= 0) {
      toast.error(t('validateMinQty'));
      return;
    }
    if (maxQty !== null && (!Number.isFinite(maxQty) || maxQty < minQty)) {
      toast.error(t('validateMaxQty'));
      return;
    }
    if (!Number.isFinite(discount) || discount <= 0) {
      toast.error(t('validateDiscount'));
      return;
    }
    if (form.discountType === 'percentage' && discount > 100) {
      toast.error(t('validateDiscount100'));
      return;
    }
    if (form.startsAt && form.endsAt) {
      const start = new Date(form.startsAt);
      const end = new Date(form.endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        toast.error(t('validateDates'));
        return;
      }
      if (start >= end) {
        toast.error(t('validateDateOrder'));
        return;
      }
    }

    setIsSaving(true);
    try {
      const stackableWith: string[] = [];
      if (form.stackPersonal) stackableWith.push('personal_price');
      if (form.stackCoupon) stackableWith.push('coupon');
      if (form.stackLoyalty) stackableWith.push('loyalty');

      const payload = {
        productId: form.productId ? Number(form.productId) : null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        minQuantity: minQty,
        maxQuantity: maxQty,
        discountPercent: discount,
        discountType: form.discountType,
        isActive: form.isActive,
        priority: Number(form.priority),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        stackableWith,
      };

      const res = editingId
        ? await apiClient.patch(`/api/v1/admin/volume-discounts/${editingId}`, payload)
        : await apiClient.post('/api/v1/admin/volume-discounts', payload);

      if (res.success) {
        toast.success(editingId ? t('savedToast') : t('createdToast'));
        resetForm();
        loadDiscounts();
      } else {
        toast.error(res.error || t('saveError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsSaving(false);
    }
  };

  // Parse pasted CSV/spreadsheet rows into discount payloads. Column order:
  // productId, categoryId, minQuantity, maxQuantity, discountPercent, priority.
  // Empty productId/categoryId/maxQuantity → null. A header row (any line with
  // letters) is dropped. Per-row validation happens server-side.
  const parseBulk = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length && /[a-zа-яіїєґ]/i.test(lines[0])) lines.shift();
    const num = (v: string | undefined) => (v === undefined || v === '' ? undefined : Number(v));
    return lines.map((line) => {
      const c = line.split(/[,;\t]/).map((x) => x.trim());
      return {
        productId: num(c[0]) ?? null,
        categoryId: num(c[1]) ?? null,
        minQuantity: num(c[2]),
        maxQuantity: num(c[3]) ?? null,
        discountPercent: num(c[4]),
        priority: num(c[5]) ?? 0,
      };
    });
  };

  const handleBulkImport = async () => {
    const items = parseBulk(bulkText);
    if (items.length === 0) {
      toast.error(t('bulkEmpty'));
      return;
    }
    setIsImporting(true);
    try {
      const res = await apiClient.post<{
        created: number;
        failed: number;
        results: Array<{ index: number; ok: boolean; error?: string }>;
      }>('/api/v1/admin/volume-discounts/bulk', { items });
      if (res.success && res.data) {
        const { created, failed, results } = res.data;
        toast.success(t('bulkResult', { created, failed }));
        if (failed > 0) {
          const firstErr = results.find((r) => !r.ok);
          if (firstErr) toast.error(`#${firstErr.index + 1}: ${firstErr.error}`);
        }
        setShowBulk(false);
        setBulkText('');
        loadDiscounts();
      } else {
        toast.error(res.error || t('bulkError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/volume-discounts/${id}`);
    if (res.success) {
      toast.success(t('deletedToast'));
    } else {
      toast.error(t('deleteError'));
    }
    loadDiscounts();
  };

  const handleToggle = async (d: VolumeDiscount) => {
    const res = await apiClient.patch(`/api/v1/admin/volume-discounts/${d.id}`, {
      isActive: !d.isActive,
    });
    if (res.success) toast.success(d.isActive ? t('disabledToast') : t('enabledToast'));
    else toast.error(res.error || t('updateError'));
    loadDiscounts();
  };

  const formatRange = (d: VolumeDiscount) => {
    if (d.maxQuantity) return t('rangeMinMax', { min: d.minQuantity, max: d.maxQuantity });
    return t('rangeFromMin', { min: d.minQuantity });
  };

  const formatDiscount = (d: VolumeDiscount) => {
    if (d.discountType === 'fixed_amount') return `${d.discountPercent} грн`;
    return `${d.discountPercent}%`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('uk-UA');
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowBulk((v) => !v);
              setShowForm(false);
            }}
          >
            {t('bulkBtn')}
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowBulk(false);
              setShowForm(true);
            }}
          >
            {t('add')}
          </Button>
        </div>
      </div>

      {showBulk && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-1 text-sm font-semibold">{t('bulkTitle')}</h3>
          <p className="mb-3 whitespace-pre-line text-xs text-[var(--color-text-secondary)]">
            {t('bulkHint')}
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            placeholder={t('bulkPlaceholder')}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-xs"
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={handleBulkImport} isLoading={isImporting} disabled={!bulkText.trim()}>
              {t('bulkImport')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulk(false);
                setBulkText('');
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{editingId ? t('edit') : t('newDiscount')}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label={t('productIdLabel')}
              type="number"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              placeholder={t('productIdPh')}
            />
            <Input
              label={t('categoryIdLabel')}
              type="number"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              placeholder={t('categoryIdPh')}
            />
            <Input
              label={t('minQtyLabel')}
              type="number"
              value={form.minQuantity}
              onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
              placeholder="10"
            />
            <Input
              label={t('maxQtyLabel')}
              type="number"
              value={form.maxQuantity}
              onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
              placeholder={t('maxQtyPh')}
            />
            <Input
              label={t('discountLabel')}
              type="number"
              value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
              placeholder="5"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {t('discountTypeLabel')}
              </label>
              <Select
                options={DISCOUNT_TYPE_OPTIONS}
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              />
            </div>
            <Input
              label={t('priorityLabel')}
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              placeholder="0"
            />
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                {t('activeLabel')}
              </label>
            </div>
            <Input
              label={t('startsAtLabel')}
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            <Input
              label={t('endsAtLabel')}
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>

          {/* Stacking — порожній набір означає «не комбінується» */}
          <div className="mt-4 rounded-md border border-[var(--color-border)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              {t('stackTitle')}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.stackPersonal}
                  onChange={(e) => setForm({ ...form, stackPersonal: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                {t('stackPersonal')}
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.stackCoupon}
                  onChange={(e) => setForm({ ...form, stackCoupon: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                {t('stackCoupon')}
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.stackLoyalty}
                  onChange={(e) => setForm({ ...form, stackLoyalty: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                {t('stackLoyalty')}
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!form.minQuantity || !form.discountPercent}
            >
              {editingId ? t('save') : t('create')}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={5} columns={7} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">{t('colProductCategory')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('colRange')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('colDiscount')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('colPriority')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('colDates')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('colStatus')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
                >
                  <td className="px-4 py-3">
                    {d.product
                      ? `${d.product.name} (${d.product.code})`
                      : d.category
                        ? t('categoryPrefix', { name: d.category.name })
                        : '—'}
                  </td>
                  <td className="px-4 py-3">{formatRange(d)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatDiscount(d)}</td>
                  <td className="px-4 py-3 text-center">{d.priority}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {formatDate(d.startsAt)} — {formatDate(d.endsAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(d)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {d.isActive ? t('active') : t('inactive')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(d)}
                      className="mr-2 text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {discounts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                  >
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message={t('deleteMsg')}
      />
    </div>
  );
}
