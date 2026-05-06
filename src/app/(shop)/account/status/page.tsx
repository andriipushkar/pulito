'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Link from 'next/link';

interface WholesaleRuleData {
  id: number;
  ruleType: 'min_order_amount' | 'min_quantity' | 'multiplicity';
  productId: number | null;
  productName?: string;
  value: number;
  isActive: boolean;
}

interface WholesaleStats {
  totalOrders: number;
  totalAmount: number;
  memberSince: string;
}

const RULE_LABELS: Record<string, string> = {
  min_order_amount: 'Мінімальна сума замовлення',
  min_quantity: 'Мінімальна кількість одиниць',
  multiplicity: 'Кратність упаковки',
};

const RULE_UNITS: Record<string, string> = {
  min_order_amount: '₴',
  min_quantity: 'шт.',
  multiplicity: 'шт.',
};

export default function StatusPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<WholesaleRuleData[]>([]);
  const [stats, setStats] = useState<WholesaleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<WholesaleRuleData[]>('/api/v1/wholesale-rules'),
      apiClient.get<WholesaleStats>('/api/v1/me/wholesale-stats'),
    ])
      .then(([rulesRes, statsRes]) => {
        if (rulesRes.success && rulesRes.data) setRules(rulesRes.data);
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );

  const statusLabel =
    user?.wholesaleStatus === 'approved'
      ? 'Гуртівник'
      : user?.wholesaleStatus === 'pending'
        ? 'Очікує підтвердження'
        : 'Клієнт';
  const statusColor =
    user?.wholesaleStatus === 'approved'
      ? 'bg-green-100 text-green-800'
      : user?.wholesaleStatus === 'pending'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-800';

  const globalRules = rules.filter((r) => !r.productId && r.isActive);
  const productRules = rules.filter((r) => r.productId && r.isActive);

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Мої умови</h2>

      {/* Status card */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
          {user?.companyName && (
            <span className="text-sm text-[var(--color-text-secondary)]">{user.companyName}</span>
          )}
        </div>

        {stats && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Всього замовлень</p>
              <p className="text-xl font-bold">{stats.totalOrders}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Загальна сума закупівель</p>
              <p className="text-xl font-bold">{Number(stats.totalAmount).toFixed(2)} ₴</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Дата отримання статусу</p>
              <p className="text-xl font-bold">
                {stats.memberSince ? formatDate(stats.memberSince) : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Global rules */}
      {globalRules.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-semibold">Загальні правила</h3>
          <div className="space-y-2">
            {globalRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-3"
              >
                <span className="text-sm">{RULE_LABELS[rule.ruleType]}</span>
                <span className="font-semibold">
                  {rule.ruleType === 'min_order_amount' &&
                    `${Number(rule.value).toFixed(0)} ${RULE_UNITS[rule.ruleType]}`}
                  {rule.ruleType !== 'min_order_amount' &&
                    `${Number(rule.value)} ${RULE_UNITS[rule.ruleType]}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product-specific rules */}
      {productRules.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-semibold">Правила для окремих товарів</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="py-2 pr-4 font-medium">Товар</th>
                  <th className="py-2 pr-4 font-medium">Правило</th>
                  <th className="py-2 font-medium">Значення</th>
                </tr>
              </thead>
              <tbody>
                {productRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-[var(--color-border)]">
                    <td className="py-2 pr-4">{rule.productName || `Товар #${rule.productId}`}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-secondary)]">
                      {RULE_LABELS[rule.ruleType]}
                    </td>
                    <td className="py-2 font-semibold">
                      {Number(rule.value)} {RULE_UNITS[rule.ruleType]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {globalRules.length === 0 && productRules.length === 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-6 text-center text-[var(--color-text-secondary)]">
          Наразі немає активних обмежень для вашого акаунту
        </div>
      )}

      <div className="mt-6 text-sm text-[var(--color-text-secondary)]">
        Маєте запитання щодо умов співпраці?{' '}
        <Link href="/account/manager" className="text-[var(--color-primary)] hover:underline">
          Зверніться до менеджера
        </Link>
      </div>
    </div>
  );
}
