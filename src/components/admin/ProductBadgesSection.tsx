'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Check, Close } from '@/components/icons';

const BADGE_TYPE_VALUES = ['promo', 'new_arrival', 'hit', 'eco', 'custom'] as const;

type BadgeType = (typeof BADGE_TYPE_VALUES)[number];

interface ProductBadge {
  id: number;
  productId: number;
  badgeType: BadgeType;
  customText: string | null;
  customColor: string | null;
  priority: number;
  isActive: boolean;
  isLocked: boolean;
}

interface AddForm {
  badgeType: BadgeType;
  customText: string;
  customColor: string;
  priority: number;
}

const EMPTY_FORM: AddForm = {
  badgeType: 'promo',
  customText: '',
  customColor: '#2563eb',
  priority: 0,
};

export default function ProductBadgesSection({ productId }: { productId: number }) {
  const t = useTranslations('admin.productBadgesSection');
  const badgeLabels = useMemo<Record<BadgeType, string>>(
    () => ({
      promo: t('typePromo'),
      new_arrival: t('typeNewArrival'),
      hit: t('typeHit'),
      eco: t('typeEco'),
      custom: t('typeCustom'),
    }),
    [t],
  );
  const BADGE_TYPES = useMemo(
    () => BADGE_TYPE_VALUES.map((value) => ({ value, label: badgeLabels[value] })),
    [badgeLabels],
  );
  const getBadgeLabel = (type: string) => badgeLabels[type as BadgeType] ?? type;
  const [badges, setBadges] = useState<ProductBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);

  const load = async () => {
    try {
      setIsLoading(true);
      // Fetch only badges for this product — the API supports a `productId`
      // filter. Previously this component pulled every badge in the system
      // and filtered client-side, getting linearly worse as the catalogue grew.
      const res = await apiClient.get<ProductBadge[]>(
        `/api/v1/admin/badges?productId=${productId}`,
      );
      setBadges(res.data ?? []);
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const usedTypes = new Set(badges.map((b) => b.badgeType));
  const availableTypes = BADGE_TYPES.filter((bt) => !usedTypes.has(bt.value));

  const handleAdd = async () => {
    if (availableTypes.length === 0) {
      toast.error(t('allTypesAdded'));
      return;
    }
    try {
      const payload = {
        productId,
        badgeType: form.badgeType,
        customText: form.badgeType === 'custom' ? form.customText.trim() || null : null,
        customColor: form.badgeType === 'custom' ? form.customColor : null,
        priority: Number(form.priority) || 0,
        isActive: true,
        isLocked: true, // pinned by admin — cron will not touch it
      };
      await apiClient.post('/api/v1/admin/badges', payload);
      toast.success(t('added'));
      setForm(EMPTY_FORM);
      setShowAdd(false);
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('createError');
      toast.error(msg);
    }
  };

  const handleToggle = async (badge: ProductBadge, field: 'isActive' | 'isLocked') => {
    try {
      await apiClient.put(`/api/v1/admin/badges/${badge.id}`, {
        [field]: !badge[field],
      });
      await load();
    } catch {
      toast.error(t('updateFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await apiClient.delete(`/api/v1/admin/badges/${id}`);
      toast.success(t('deleted'));
      await load();
    } catch {
      toast.error(t('deleteFailed'));
    }
  };

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <Button
          variant="secondary"
          onClick={() => setShowAdd((v) => !v)}
          disabled={availableTypes.length === 0}
        >
          {showAdd ? t('cancel') : t('addBadge')}
        </Button>
      </div>

      {isLoading && (
        <div className="text-sm text-[var(--color-text-secondary)]">{t('loading')}</div>
      )}

      {!isLoading && badges.length === 0 && !showAdd && (
        <p className="text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
      )}

      {badges.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {badges.map((b) => (
            <div
              key={b.id}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: b.customColor || '#2563eb' }}
              />
              <span className="font-medium">{b.customText || getBadgeLabel(b.badgeType)}</span>
              <span className="text-[var(--color-text-secondary)]">#{b.priority}</span>
              <button
                type="button"
                title={b.isActive ? t('activeTitle') : t('hiddenTitle')}
                onClick={() => handleToggle(b, 'isActive')}
                className="text-[var(--color-text-secondary)] hover:opacity-70"
              >
                {b.isActive ? <Check className="h-3.5 w-3.5" /> : <Close className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                title={b.isLocked ? t('lockedTitle') : t('unlockedTitle')}
                onClick={() => handleToggle(b, 'isLocked')}
                className={
                  b.isLocked
                    ? 'text-amber-500'
                    : 'text-[var(--color-text-secondary)] hover:opacity-70'
                }
              >
                {b.isLocked ? '🔒' : '🔓'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(b.id)}
                className="text-red-500 hover:opacity-70"
                aria-label={t('deleteAria')}
              >
                <Close className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="rounded-md border border-[var(--color-border)] p-3">
          <div
            className={`grid gap-3 ${form.badgeType === 'custom' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
          >
            <div>
              <label className="mb-1 block text-xs font-medium">{t('typeLabel')}</label>
              <select
                value={form.badgeType}
                onChange={(e) => setForm({ ...form, badgeType: e.target.value as BadgeType })}
                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm"
              >
                {availableTypes.map((bt) => (
                  <option key={bt.value} value={bt.value}>
                    {bt.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('priorityLabel')}
              type="number"
              value={String(form.priority)}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
            />
            {form.badgeType === 'custom' && (
              <>
                <Input
                  label={t('textLabel')}
                  value={form.customText}
                  onChange={(e) => setForm({ ...form, customText: e.target.value })}
                />
                <div>
                  <label className="mb-1 block text-xs font-medium">{t('colorLabel')}</label>
                  <input
                    type="color"
                    value={form.customColor}
                    onChange={(e) => setForm({ ...form, customColor: e.target.value })}
                    className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAdd(false);
                setForm(EMPTY_FORM);
              }}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleAdd}>{t('add')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
