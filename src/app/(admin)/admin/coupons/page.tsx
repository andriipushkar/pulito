'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';

interface Coupon {
  id: number;
  code: string;
  description: string | null;
  type: 'percent' | 'fixed_amount' | 'free_delivery';
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

const TYPE_COLORS: Record<Coupon['type'], string> = {
  percent: 'bg-blue-100 text-blue-700',
  fixed_amount: 'bg-emerald-100 text-emerald-700',
  free_delivery: 'bg-amber-100 text-amber-700',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function CouponsAdminPage() {
  const t = useTranslations('admin.couponsPage');
  const TYPE_LABELS: Record<Coupon['type'], string> = {
    percent: t('typePercent'),
    fixed_amount: t('typeFixed'),
    free_delivery: t('typeFreeDelivery'),
  };
  const formatValue = (c: Coupon): string => {
    if (c.type === 'percent') return `${c.value}%`;
    if (c.type === 'fixed_amount') return `${c.value} ₴`;
    return t('freeDeliveryValue');
  };
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpired, setShowExpired] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await apiClient.get<{ coupons: Coupon[]; total: number }>(
      `/api/v1/admin/coupons?expired=${showExpired}&limit=100`,
    );
    if (res.success && res.data) setCoupons(res.data.coupons);
    setIsLoading(false);
  }, [showExpired]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            {t('showInactive')}
          </label>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            {t('createBtn')}
          </Button>
        </div>
      </div>

      {showCreate && (
        <CouponCreateForm
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] py-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
            <span className="text-2xl" aria-hidden="true">
              🎟️
            </span>
          </div>
          <p className="mb-1 text-sm font-semibold text-[var(--color-text)]">{t('emptyTitle')}</p>
          <p className="mx-auto mb-4 max-w-xs text-xs text-[var(--color-text-secondary)]">
            {t('emptyHint')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-2.5 text-left">{t('colCode')}</th>
                <th className="px-4 py-2.5 text-left">{t('colType')}</th>
                <th className="px-4 py-2.5 text-right">{t('colValue')}</th>
                <th className="px-4 py-2.5 text-right">{t('colUsed')}</th>
                <th className="px-4 py-2.5 text-left">{t('colValidUntil')}</th>
                <th className="px-4 py-2.5 text-center">{t('colActive')}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--color-bg-secondary)]/50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-[var(--color-text)]">
                      {c.code}
                    </span>
                    {c.description && (
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {c.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[c.type]}`}
                    >
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatValue(c)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.usedCount}
                    {c.usageLimit && (
                      <span className="text-[var(--color-text-secondary)]"> / {c.usageLimit}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDate(c.validUntil)}</td>
                  <td className="px-4 py-3 text-center">
                    {c.isActive ? (
                      <span
                        className="inline-flex h-2 w-2 rounded-full bg-emerald-500"
                        aria-label={t('ariaActive')}
                      />
                    ) : (
                      <span
                        className="inline-flex h-2 w-2 rounded-full bg-gray-300"
                        aria-label={t('ariaInactive')}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <CouponToggle coupon={c} onToggled={load} />
                      <CouponDelete coupon={c} onDeleted={load} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CouponToggle({ coupon, onToggled }: { coupon: Coupon; onToggled: () => void }) {
  const t = useTranslations('admin.couponsPage');
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await apiClient.patch(`/api/v1/admin/coupons/${coupon.id}`, {
          isActive: !coupon.isActive,
        });
        setBusy(false);
        if (res.success) {
          toast.success(coupon.isActive ? t('deactivatedToast') : t('activatedToast'));
          onToggled();
        } else {
          toast.error(res.error || t('errorGeneric'));
        }
      }}
      className="text-xs font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50"
    >
      {coupon.isActive ? t('deactivateBtn') : t('activateBtn')}
    </button>
  );
}

function CouponDelete({ coupon, onDeleted }: { coupon: Coupon; onDeleted: () => void }) {
  const t = useTranslations('admin.couponsPage');
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t('deleteConfirm', { code: coupon.code }))) return;
        setBusy(true);
        const res = await apiClient.delete(`/api/v1/admin/coupons/${coupon.id}`);
        setBusy(false);
        if (res.success) {
          toast.success(t('deletedToast'));
          onDeleted();
        } else {
          toast.error(res.error || t('errorGeneric'));
        }
      }}
      className="text-xs font-medium text-[var(--color-danger)] hover:underline disabled:opacity-50"
    >
      {t('deleteBtn')}
    </button>
  );
}

function CouponCreateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('admin.couponsPage');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Coupon['type']>('percent');
  const [value, setValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [validUntil, setValidUntil] = useState('');
  // Restriction inputs — comma-separated lists. Form accepts raw IDs and
  // converts to int[] at submit. Categories: coupon applies only if any of
  // these IDs match; Excluded: never apply on those products.
  const [applicableCategoryIds, setApplicableCategoryIds] = useState('');
  const [excludedProductIds, setExcludedProductIds] = useState('');
  // Stacking — checkbox per discount type. Empty = doesn't stack with anything.
  const [stackVolume, setStackVolume] = useState(false);
  const [stackPersonal, setStackPersonal] = useState(false);
  const [stackLoyalty, setStackLoyalty] = useState(false);
  const [busy, setBusy] = useState(false);

  const parseIds = (raw: string): number[] =>
    raw
      .split(/[\s,;]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error(t('validateCode'));
      return;
    }
    if (type !== 'free_delivery' && !value.trim()) {
      toast.error(t('validateValue'));
      return;
    }
    const numValue = type === 'free_delivery' ? 0 : Number(value);
    if (type !== 'free_delivery') {
      if (!Number.isFinite(numValue) || numValue <= 0) {
        toast.error(t('validateValuePositive'));
        return;
      }
      if (type === 'percent' && numValue > 100) {
        toast.error(t('validatePercent100'));
        return;
      }
    }
    let validUntilIso: string | undefined;
    if (validUntil) {
      const d = new Date(validUntil);
      if (Number.isNaN(d.getTime())) {
        toast.error(t('validateDateFormat'));
        return;
      }
      if (d <= new Date()) {
        toast.error(t('validateDateFuture'));
        return;
      }
      validUntilIso = d.toISOString();
    }
    setBusy(true);
    const stackableWith: string[] = [];
    if (stackVolume) stackableWith.push('volume');
    if (stackPersonal) stackableWith.push('personal_price');
    if (stackLoyalty) stackableWith.push('loyalty');

    const res = await apiClient.post('/api/v1/admin/coupons', {
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      type,
      value: numValue,
      ...(minOrderAmount && { minOrderAmount: Number(minOrderAmount) }),
      ...(maxDiscount && type === 'percent' && { maxDiscount: Number(maxDiscount) }),
      ...(usageLimit && { usageLimit: Number(usageLimit) }),
      ...(validUntilIso && { validUntil: validUntilIso }),
      applicableCategoryIds: parseIds(applicableCategoryIds),
      excludedProductIds: parseIds(excludedProductIds),
      stackableWith,
    });
    setBusy(false);
    if (res.success) {
      toast.success(t('createdToast'));
      onCreated();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-5">
      <h3 className="mb-4 text-sm font-bold">{t('newTitle')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('codeLabel')}</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
            placeholder={t('codePh')}
            className="font-mono uppercase"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('typeLabel')}</label>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as Coupon['type'])}
            options={[
              { value: 'percent', label: t('typeOptPercent') },
              { value: 'fixed_amount', label: t('typeOptFixed') },
              { value: 'free_delivery', label: t('typeOptFreeDelivery') },
            ]}
          />
        </div>
        {type !== 'free_delivery' && (
          <div>
            <label className="mb-1 block text-xs font-medium">
              {type === 'percent' ? t('valueLabelPercent') : t('valueLabelFixed')}
            </label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'percent' ? '15' : '100'}
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium">{t('minOrderLabel')}</label>
          <Input
            type="number"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            placeholder="500"
          />
        </div>
        {type === 'percent' && (
          <div>
            <label className="mb-1 block text-xs font-medium">{t('maxDiscountLabel')}</label>
            <Input
              type="number"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="1000"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium">{t('usageLimitLabel')}</label>
          <Input
            type="number"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('validUntilLabel')}</label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">{t('descriptionLabel')}</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPh')}
          />
        </div>

        {/* Product/category restrictions */}
        <div className="sm:col-span-2 rounded-md border border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            {t('restrictionsTitle')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">
                {t('allowedCategoriesLabel')}
              </label>
              <Input
                value={applicableCategoryIds}
                onChange={(e) => setApplicableCategoryIds(e.target.value)}
                placeholder={t('allowedCategoriesPh')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t('excludedProductsLabel')}</label>
              <Input
                value={excludedProductIds}
                onChange={(e) => setExcludedProductIds(e.target.value)}
                placeholder={t('excludedProductsPh')}
              />
            </div>
          </div>
        </div>

        {/* Stacking */}
        <div className="sm:col-span-2 rounded-md border border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            {t('stackTitle')}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stackVolume}
                onChange={(e) => setStackVolume(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              {t('stackVolume')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stackPersonal}
                onChange={(e) => setStackPersonal(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              {t('stackPersonal')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stackLoyalty}
                onChange={(e) => setStackLoyalty(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              {t('stackLoyalty')}
            </label>
          </div>
          <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">{t('stackHint')}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={handleSubmit} isLoading={busy}>
          {t('create')}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
