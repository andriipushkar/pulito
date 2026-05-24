'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { formatPrice } from '@/utils/format';

type SegmentField = 'orderCount' | 'totalSpent' | 'lastOrderDays' | 'city';
type SegmentOp = 'gte' | 'lte' | 'eq' | 'contains';

interface SegmentRule {
  id: string;
  field: SegmentField;
  op: SegmentOp;
  value: string;
}

interface SegmentResult {
  total: number;
  computedAt?: string;
  users: {
    id: number;
    fullName: string | null;
    email: string;
    phone: string | null;
    role?: string;
    orderCount: number;
    totalSpent: number;
    lastOrderDays: number | null;
    city: string | null;
  }[];
}

type SegmentRoleScope = 'client' | 'wholesaler' | 'both';

const FIELD_LABELS: Record<SegmentField, string> = {
  orderCount: 'Кількість замовлень',
  totalSpent: 'Загальна сума',
  lastOrderDays: 'Днів з останнього замовлення',
  city: 'Місто',
};

const FIELDS_FOR_OP: Record<SegmentField, SegmentOp[]> = {
  orderCount: ['gte', 'lte', 'eq'],
  totalSpent: ['gte', 'lte'],
  lastOrderDays: ['gte', 'lte'],
  city: ['eq', 'contains'],
};

const OP_LABELS: Record<SegmentOp, string> = {
  gte: '≥',
  lte: '≤',
  eq: '=',
  contains: 'містить',
};

const PRESETS: { label: string; rules: Omit<SegmentRule, 'id'>[] }[] = [
  {
    label: 'VIP-клієнти (>3 замовлень)',
    rules: [{ field: 'orderCount', op: 'gte', value: '3' }],
  },
  {
    label: 'Сплячі (не купували 60+ днів)',
    rules: [
      { field: 'lastOrderDays', op: 'gte', value: '60' },
      { field: 'orderCount', op: 'gte', value: '1' },
    ],
  },
  {
    label: 'Високий середній чек (>2000 грн)',
    rules: [{ field: 'totalSpent', op: 'gte', value: '2000' }],
  },
  {
    label: 'Клієнти з Києва',
    rules: [{ field: 'city', op: 'contains', value: 'Київ' }],
  },
];

function newRule(): SegmentRule {
  return {
    id: Math.random().toString(36).slice(2),
    field: 'orderCount',
    op: 'gte',
    value: '1',
  };
}

export default function SegmentsPage() {
  const [rules, setRules] = useState<SegmentRule[]>([newRule()]);
  const [result, setResult] = useState<SegmentResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [roleScope, setRoleScope] = useState<SegmentRoleScope>('client');
  const [pageOffset, setPageOffset] = useState(0);
  const PAGE_LIMIT = 100;

  const runPreview = async (offset = 0) => {
    for (const r of rules) {
      if (r.value === '' || r.value === null || r.value === undefined) {
        toast.error('Заповніть значення для всіх правил');
        return;
      }
      if (r.field !== 'city') {
        const n = Number(r.value);
        if (!Number.isFinite(n)) {
          toast.error(`Невірне числове значення для "${r.field}"`);
          return;
        }
      }
    }
    setIsRunning(true);
    const roles = roleScope === 'both' ? ['client', 'wholesaler'] : [roleScope];
    const res = await apiClient.post<SegmentResult>('/api/v1/admin/segments/preview', {
      rules: rules.map((r) => ({
        field: r.field,
        op: r.op,
        value: r.field === 'city' ? r.value : Number(r.value),
      })),
      limit: PAGE_LIMIT,
      offset,
      roles,
    });
    setIsRunning(false);
    if (res.success && res.data) {
      setResult(res.data);
      setPageOffset(offset);
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setRules(preset.rules.map((r) => ({ ...r, id: Math.random().toString(36).slice(2) })));
    setResult(null);
  };

  const exportPhones = () => {
    if (!result) return;
    const text = result.users
      .map((u) => u.phone)
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success(`Скопійовано ${text.split('\n').length} номерів`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Сегменти клієнтів</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Сформуйте групу клієнтів за критеріями, перегляньте і експортуйте список номерів для
          SMS-розсилки.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">
          Швидкі шаблони:
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Правила (всі мають виконуватись)</h3>
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">{i + 1}.</span>
              <Select
                value={rule.field}
                onChange={(e) => {
                  const field = e.target.value as SegmentField;
                  setRules((rs) =>
                    rs.map((r) =>
                      r.id === rule.id ? { ...r, field, op: FIELDS_FOR_OP[field][0] } : r,
                    ),
                  );
                }}
                options={Object.entries(FIELD_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                className="w-48"
              />
              <Select
                value={rule.op}
                onChange={(e) =>
                  setRules((rs) =>
                    rs.map((r) =>
                      r.id === rule.id ? { ...r, op: e.target.value as SegmentOp } : r,
                    ),
                  )
                }
                options={FIELDS_FOR_OP[rule.field].map((o) => ({ value: o, label: OP_LABELS[o] }))}
                className="w-28"
              />
              <Input
                value={rule.value}
                onChange={(e) =>
                  setRules((rs) =>
                    rs.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r)),
                  )
                }
                className="w-32"
              />
              {rules.length > 1 && (
                <button
                  onClick={() => setRules((rs) => rs.filter((r) => r.id !== rule.id))}
                  className="rounded p-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-bg-secondary)]"
                  aria-label="Видалити правило"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setRules((r) => [...r, newRule()])}>
            + Додати правило
          </Button>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[var(--color-text-secondary)]">Кого включити:</span>
            <select
              value={roleScope}
              onChange={(e) => setRoleScope(e.target.value as SegmentRoleScope)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
            >
              <option value="client">Тільки роздрібних</option>
              <option value="wholesaler">Тільки гуртових</option>
              <option value="both">Обох</option>
            </select>
          </div>
          <Button size="sm" onClick={() => runPreview(0)} disabled={isRunning}>
            {isRunning ? 'Обчислюємо…' : 'Перегляд'}
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">
                Знайдено: <span className="text-[var(--color-primary)]">{result.total}</span>{' '}
                клієнтів
                {result.total > PAGE_LIMIT && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">
                    (показано {pageOffset + 1}–
                    {Math.min(pageOffset + result.users.length, result.total)})
                  </span>
                )}
              </h3>
              {result.computedAt && (
                <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                  Обчислено: {new Date(result.computedAt).toLocaleString('uk-UA')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {result.total > PAGE_LIMIT && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runPreview(Math.max(0, pageOffset - PAGE_LIMIT))}
                    disabled={pageOffset === 0 || isRunning}
                  >
                    ← Назад
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runPreview(pageOffset + PAGE_LIMIT)}
                    disabled={pageOffset + PAGE_LIMIT >= result.total || isRunning}
                  >
                    Вперед →
                  </Button>
                </>
              )}
              {result.users.length > 0 && (
                <Button size="sm" variant="outline" onClick={exportPhones}>
                  📋 Скопіювати телефони
                </Button>
              )}
            </div>
          </div>
          {result.users.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
              Жоден клієнт не відповідає правилам.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-2 py-2">Ім&apos;я</th>
                    <th className="px-2 py-2">Телефон</th>
                    <th className="px-2 py-2 text-right">Замовлень</th>
                    <th className="px-2 py-2 text-right">Витрачено</th>
                    <th className="px-2 py-2 text-right">Днів тому</th>
                  </tr>
                </thead>
                <tbody>
                  {result.users.map((u) => (
                    <tr key={u.id} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-2">
                        <a
                          href={`/admin/users/${u.id}`}
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          {u.fullName || u.email}
                        </a>
                      </td>
                      <td className="px-2 py-2 font-mono">{u.phone || '—'}</td>
                      <td className="px-2 py-2 text-right">{u.orderCount}</td>
                      <td className="px-2 py-2 text-right">{formatPrice(u.totalSpent)}</td>
                      <td className="px-2 py-2 text-right">
                        {u.lastOrderDays === null ? '—' : u.lastOrderDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
