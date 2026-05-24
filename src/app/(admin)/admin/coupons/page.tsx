'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
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

const TYPE_LABELS: Record<Coupon['type'], string> = {
  percent: 'Відсоток',
  fixed_amount: 'Фіксована знижка',
  free_delivery: 'Безкоштовна доставка',
};

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

function formatValue(c: Coupon): string {
  if (c.type === 'percent') return `${c.value}%`;
  if (c.type === 'fixed_amount') return `${c.value} ₴`;
  return 'Безкоштовна';
}

export default function CouponsAdminPage() {
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
          <h2 className="text-xl font-bold">Промокоди</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Створюйте знижки за кодом для клієнтів. Введений у кошику код застосовується на ту ж
            сесію.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Показати неактивні
          </label>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            + Створити промокод
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
          <p className="mb-1 text-sm font-semibold text-[var(--color-text)]">Промокодів немає</p>
          <p className="mx-auto mb-4 max-w-xs text-xs text-[var(--color-text-secondary)]">
            Створіть перший промокод щоб залучати клієнтів і піднімати конверсію
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-2.5 text-left">Код</th>
                <th className="px-4 py-2.5 text-left">Тип</th>
                <th className="px-4 py-2.5 text-right">Значення</th>
                <th className="px-4 py-2.5 text-right">Використано</th>
                <th className="px-4 py-2.5 text-left">Дійсний до</th>
                <th className="px-4 py-2.5 text-center">Активний</th>
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
                        aria-label="Активний"
                      />
                    ) : (
                      <span
                        className="inline-flex h-2 w-2 rounded-full bg-gray-300"
                        aria-label="Неактивний"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CouponToggle coupon={c} onToggled={load} />
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
          toast.success(coupon.isActive ? 'Деактивовано' : 'Активовано');
          onToggled();
        } else {
          toast.error(res.error || 'Помилка');
        }
      }}
      className="text-xs font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50"
    >
      {coupon.isActive ? 'Деактивувати' : 'Активувати'}
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
      toast.error('Введіть код промокоду');
      return;
    }
    if (type !== 'free_delivery' && !value.trim()) {
      toast.error('Введіть значення знижки');
      return;
    }
    const numValue = type === 'free_delivery' ? 0 : Number(value);
    if (type !== 'free_delivery') {
      if (!Number.isFinite(numValue) || numValue <= 0) {
        toast.error('Значення має бути більше 0');
        return;
      }
      if (type === 'percent' && numValue > 100) {
        toast.error('Відсоток не може перевищувати 100');
        return;
      }
    }
    let validUntilIso: string | undefined;
    if (validUntil) {
      const d = new Date(validUntil);
      if (Number.isNaN(d.getTime())) {
        toast.error('Невірний формат дати');
        return;
      }
      if (d <= new Date()) {
        toast.error('Дата завершення має бути в майбутньому');
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
      toast.success('Промокод створено');
      onCreated();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-5">
      <h3 className="mb-4 text-sm font-bold">Новий промокод</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Код *</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
            placeholder="SUMMER25"
            className="font-mono uppercase"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Тип *</label>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as Coupon['type'])}
            options={[
              { value: 'percent', label: 'Відсоток (%)' },
              { value: 'fixed_amount', label: 'Фіксована сума (₴)' },
              { value: 'free_delivery', label: 'Безкоштовна доставка' },
            ]}
          />
        </div>
        {type !== 'free_delivery' && (
          <div>
            <label className="mb-1 block text-xs font-medium">
              Значення * {type === 'percent' ? '(%)' : '(₴)'}
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
          <label className="mb-1 block text-xs font-medium">Мін. сума замовлення (₴)</label>
          <Input
            type="number"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            placeholder="500"
          />
        </div>
        {type === 'percent' && (
          <div>
            <label className="mb-1 block text-xs font-medium">Макс. знижка (₴)</label>
            <Input
              type="number"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="1000"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium">Ліміт використань</label>
          <Input
            type="number"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Дійсний до</label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Опис (видно клієнту)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Літня знижка 25% на все"
          />
        </div>

        {/* Product/category restrictions */}
        <div className="sm:col-span-2 rounded-md border border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            Обмеження
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Дозволені категорії (ID через кому, пусто = всі)
              </label>
              <Input
                value={applicableCategoryIds}
                onChange={(e) => setApplicableCategoryIds(e.target.value)}
                placeholder="5, 12, 18"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                Виключені товари (ID через кому)
              </label>
              <Input
                value={excludedProductIds}
                onChange={(e) => setExcludedProductIds(e.target.value)}
                placeholder="42, 87"
              />
            </div>
          </div>
        </div>

        {/* Stacking */}
        <div className="sm:col-span-2 rounded-md border border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            Поєднання з іншими знижками
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stackVolume}
                onChange={(e) => setStackVolume(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              Знижка за обсяг
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stackPersonal}
                onChange={(e) => setStackPersonal(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              Персональна ціна
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={stackLoyalty}
                onChange={(e) => setStackLoyalty(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              Бали лояльності
            </label>
          </div>
          <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
            Якщо нічого не обрано — промокод не комбінується з іншими знижками
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={handleSubmit} isLoading={busy}>
          Створити
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Скасувати
        </Button>
      </div>
    </div>
  );
}
