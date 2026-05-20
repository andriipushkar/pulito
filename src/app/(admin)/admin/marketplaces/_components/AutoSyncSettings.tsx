'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import { MARKETPLACES, type AutoSyncMap, type SyncInterval, type SyncType } from '../_shared';

export function syncTypeLabel(type: SyncType): string {
  if (type === 'products') return 'Товари';
  if (type === 'stock') return 'Залишки';
  return 'Замовлення';
}

export function AutoSyncSettings() {
  const [settings, setSettings] = useState<AutoSyncMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiClient.get<AutoSyncMap>('/api/v1/admin/marketplaces/auto-sync').then((res) => {
      if (res.success && res.data) setSettings(res.data);
      setIsLoading(false);
    });
  }, []);

  const updateField = async (platform: string, type: SyncType, value: SyncInterval) => {
    const next = {
      ...settings,
      [platform]: { ...(settings[platform] || {}), [type]: value },
    };
    setSettings(next);
    setIsSaving(true);
    const res = await apiClient.put('/api/v1/admin/marketplaces/auto-sync', next);
    if (!res.success) toast.error(res.error || 'Не вдалося зберегти');
    setIsSaving(false);
  };

  if (isLoading) return <Spinner size="sm" />;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
              <th className="px-2 py-2">Маркетплейс</th>
              <th className="px-2 py-2">Товари</th>
              <th className="px-2 py-2">Залишки</th>
              <th className="px-2 py-2">Замовлення</th>
            </tr>
          </thead>
          <tbody>
            {MARKETPLACES.map((m) => (
              <tr key={m.key} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-2 py-2">
                  <span className="mr-1.5">{m.icon}</span>
                  <span className="text-sm font-medium">{m.name}</span>
                </td>
                {(['products', 'stock', 'orders'] as SyncType[]).map((type) => (
                  <td key={type} className="px-2 py-2">
                    <select
                      disabled={!m.supports[type]}
                      value={(settings[m.key]?.[type] as SyncInterval) || 'off'}
                      onChange={(e) =>
                        updateField(m.key, type, e.target.value as SyncInterval)
                      }
                      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs disabled:opacity-40"
                      title={m.supports[type] ? '' : 'Не підтримується'}
                    >
                      <option value="off">Вимкнено</option>
                      <option value="1h">Щогодини</option>
                      <option value="6h">Кожні 6 год</option>
                      <option value="12h">Кожні 12 год</option>
                      <option value="24h">Раз на добу</option>
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--color-text-secondary)]">
        Налаштування застосовуються cron-завданням `marketplace-health-check` / `sync-marketplace-*`.
        {isSaving && <span className="ml-2 text-[var(--color-primary)]">Зберігаю...</span>}
      </p>
    </div>
  );
}
