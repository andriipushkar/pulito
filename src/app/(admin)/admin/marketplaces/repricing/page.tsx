'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

type ConditionType =
  | 'always'
  | 'stock_below'
  | 'stock_above'
  | 'date_between'
  | 'category_in'
  | 'product_in';

interface RepricingCondition {
  type: ConditionType;
  value?: number;
  from?: string;
  to?: string;
  categoryIds?: number[];
  productIds?: number[];
}

interface RepricingRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: RepricingCondition;
  markupPercent: number;
}

const MARKETPLACES = [
  { key: 'olx', name: 'OLX', icon: '🟢' },
  { key: 'rozetka', name: 'Rozetka', icon: '🟩' },
  { key: 'prom', name: 'Prom.ua', icon: '🔵' },
  { key: 'epicentrk', name: 'Epicentr K', icon: '🟠' },
] as const;
type PlatformKey = (typeof MARKETPLACES)[number]['key'];

function newRule(): RepricingRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    enabled: true,
    condition: { type: 'always' },
    markupPercent: 0,
  };
}

export default function MarketplaceRepricingPage() {
  const t = useTranslations('admin.marketplaceRepricingPage');
  const CONDITION_LABEL: Record<ConditionType, string> = {
    always: t('condAlways'),
    stock_below: t('condStockBelow'),
    stock_above: t('condStockAbove'),
    date_between: t('condDateBetween'),
    category_in: t('condCategoryIn'),
    product_in: t('condProductIn'),
  };
  const [rulesByPlatform, setRules] = useState<Record<PlatformKey, RepricingRule[]>>({
    olx: [],
    rozetka: [],
    prom: [],
    epicentrk: [],
  });
  const [active, setActive] = useState<PlatformKey>('rozetka');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      MARKETPLACES.map((m) =>
        apiClient.get<RepricingRule[]>(`/api/v1/admin/marketplaces/${m.key}/repricing`),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<PlatformKey, RepricingRule[]> = {
          olx: [],
          rozetka: [],
          prom: [],
          epicentrk: [],
        };
        MARKETPLACES.forEach((m, i) => {
          const r = results[i];
          if (r.success && Array.isArray(r.data)) next[m.key] = r.data;
        });
        setRules(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const updateRule = (idx: number, patch: Partial<RepricingRule>) => {
    setRules((prev) => {
      const arr = [...prev[active]];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, [active]: arr };
    });
  };

  const updateCondition = (idx: number, patch: Partial<RepricingCondition>) => {
    setRules((prev) => {
      const arr = [...prev[active]];
      arr[idx] = { ...arr[idx], condition: { ...arr[idx].condition, ...patch } };
      return { ...prev, [active]: arr };
    });
  };

  const addRule = () => {
    setRules((prev) => ({ ...prev, [active]: [...prev[active], newRule()] }));
  };

  const removeRule = (idx: number) => {
    setRules((prev) => {
      const arr = [...prev[active]];
      arr.splice(idx, 1);
      return { ...prev, [active]: arr };
    });
  };

  const moveRule = (idx: number, dir: -1 | 1) => {
    setRules((prev) => {
      const arr = [...prev[active]];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, [active]: arr };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await apiClient.put(`/api/v1/admin/marketplaces/${active}/repricing`, {
      rules: rulesByPlatform[active],
    });
    if (res.success) {
      toast.success(
        t('savedToast', { name: MARKETPLACES.find((m) => m.key === active)?.name ?? '' }),
      );
      refresh();
    } else {
      toast.error(res.error || t('saveError'));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  const rules = rulesByPlatform[active];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/marketplaces"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          {t('backArrow')}
        </Link>
        <h2 className="mt-1 text-xl font-bold">{t('title')}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
      </div>

      <div className="mb-4 flex gap-2 border-b border-[var(--color-border)]">
        {MARKETPLACES.map((m) => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              active === m.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>{m.icon}</span>
            <span>{m.name}</span>
            {rulesByPlatform[m.key].length > 0 && (
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px]">
                {rulesByPlatform[m.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {rules.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-center text-[var(--color-text-secondary)]">
            <p className="text-lg">{t('emptyTitle')}</p>
            <p className="mt-1 text-sm">{t('emptyHint')}</p>
          </div>
        )}

        {rules.map((rule, idx) => (
          <div
            key={rule.id}
            className={`rounded-[var(--radius)] border p-4 ${
              rule.enabled
                ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] opacity-60'
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                #{idx + 1}
              </span>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => updateRule(idx, { enabled: e.target.checked })}
                title={t('enableTitle')}
              />
              <Input
                value={rule.name}
                onChange={(e) => updateRule(idx, { name: e.target.value })}
                placeholder={t('namePh')}
                className="flex-1"
              />
              <button
                onClick={() => moveRule(idx, -1)}
                disabled={idx === 0}
                title={t('moveUp')}
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)] disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => moveRule(idx, 1)}
                disabled={idx === rules.length - 1}
                title={t('moveDown')}
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)] disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => removeRule(idx)}
                title={t('remove')}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span>{t('conditionLabel')}</span>
                <select
                  value={rule.condition.type}
                  onChange={(e) => updateCondition(idx, { type: e.target.value as ConditionType })}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1"
                >
                  {(Object.keys(CONDITION_LABEL) as ConditionType[]).map((t) => (
                    <option key={t} value={t}>
                      {CONDITION_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>

              {(rule.condition.type === 'stock_below' || rule.condition.type === 'stock_above') && (
                <label className="flex items-center gap-2">
                  <span>{t('qtyLabel')}</span>
                  <Input
                    type="number"
                    value={String(rule.condition.value ?? '')}
                    onChange={(e) => updateCondition(idx, { value: Number(e.target.value) })}
                    className="w-24"
                  />
                </label>
              )}

              {rule.condition.type === 'date_between' && (
                <>
                  <label className="flex items-center gap-2">
                    <span>{t('fromLabel')}</span>
                    <Input
                      type="date"
                      value={rule.condition.from || ''}
                      onChange={(e) => updateCondition(idx, { from: e.target.value })}
                      className="w-40"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span>{t('toLabel')}</span>
                    <Input
                      type="date"
                      value={rule.condition.to || ''}
                      onChange={(e) => updateCondition(idx, { to: e.target.value })}
                      className="w-40"
                    />
                  </label>
                </>
              )}

              {rule.condition.type === 'category_in' && (
                <label className="flex items-center gap-2">
                  <span>{t('categoryIdsLabel')}</span>
                  <Input
                    value={(rule.condition.categoryIds || []).join(',')}
                    onChange={(e) =>
                      updateCondition(idx, {
                        categoryIds: e.target.value
                          .split(',')
                          .map((s) => Number(s.trim()))
                          .filter(Number.isFinite),
                      })
                    }
                    className="w-56"
                  />
                </label>
              )}

              {rule.condition.type === 'product_in' && (
                <label className="flex items-center gap-2">
                  <span>{t('productIdsLabel')}</span>
                  <Input
                    value={(rule.condition.productIds || []).join(',')}
                    onChange={(e) =>
                      updateCondition(idx, {
                        productIds: e.target.value
                          .split(',')
                          .map((s) => Number(s.trim()))
                          .filter(Number.isFinite),
                      })
                    }
                    className="w-56"
                  />
                </label>
              )}

              <label className="flex items-center gap-2">
                <span>{t('markupLabel')}</span>
                <Input
                  type="number"
                  step="0.1"
                  min={-50}
                  max={50}
                  value={String(rule.markupPercent)}
                  onChange={(e) => updateRule(idx, { markupPercent: Number(e.target.value) })}
                  className="w-24"
                />
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {t('markupHint')}
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={addRule} variant="outline">
          {t('addRule')}
        </Button>
        <Button onClick={handleSave} isLoading={saving}>
          {t('saveBtn', { name: MARKETPLACES.find((m) => m.key === active)?.name ?? '' })}
        </Button>
      </div>
    </div>
  );
}
