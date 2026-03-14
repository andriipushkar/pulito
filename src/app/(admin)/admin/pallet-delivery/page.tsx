'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PalletRegion {
  name: string;
  multiplier: number;
}

interface PalletConfig {
  enabled: boolean;
  minWeightKg: number;
  maxWeightKg: number;
  basePrice: number;
  pricePerKg: number;
  regions: PalletRegion[];
  freeDeliveryThreshold: number;
  estimatedDays: string;
}

export default function AdminPalletDeliveryPage() {
  const [config, setConfig] = useState<PalletConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    apiClient
      .get<PalletConfig>('/api/v1/admin/settings/pallet-delivery')
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setConfirmSave(false);
    setIsSaving(true);
    const res = await apiClient.put('/api/v1/admin/settings/pallet-delivery', config);
    setIsSaving(false);
    if (res.success) toast.success('Налаштування доставки збережено');
    else toast.error(res.error || 'Помилка збереження');
  }, [config]);

  const updateField = useCallback((field: keyof PalletConfig, value: unknown) => {
    setConfig((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const updateRegion = useCallback((index: number, field: keyof PalletRegion, value: string | number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const regions = [...prev.regions];
      regions[index] = { ...regions[index], [field]: value };
      return { ...prev, regions };
    });
  }, []);

  const addRegion = useCallback(() => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, regions: [...prev.regions, { name: '', multiplier: 1 }] };
    });
  }, []);

  const removeRegion = useCallback((index: number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, regions: prev.regions.filter((_, i) => i !== index) };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!config) {
    return <p className="py-8 text-center text-[var(--color-text-secondary)]">Не вдалося завантажити конфігурацію</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Палетна доставка</h1>
        <Button onClick={() => setConfirmSave(true)} isLoading={isSaving}>Зберегти</Button>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateField('enabled', e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Увімкнено
          </label>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Input
            label="Мін. вага (кг)"
            type="number"
            value={String(config.minWeightKg)}
            onChange={(e) => updateField('minWeightKg', Number(e.target.value))}
          />
          <Input
            label="Макс. вага (кг)"
            type="number"
            value={String(config.maxWeightKg)}
            onChange={(e) => updateField('maxWeightKg', Number(e.target.value))}
          />
          <Input
            label="Базова ціна (грн)"
            type="number"
            value={String(config.basePrice)}
            onChange={(e) => updateField('basePrice', Number(e.target.value))}
          />
          <Input
            label="Ціна за кг (грн)"
            type="number"
            value={String(config.pricePerKg)}
            onChange={(e) => updateField('pricePerKg', Number(e.target.value))}
          />
          <Input
            label="Безкоштовно від (грн)"
            type="number"
            value={String(config.freeDeliveryThreshold)}
            onChange={(e) => updateField('freeDeliveryThreshold', Number(e.target.value))}
          />
          <Input
            label="Орієнтовний термін"
            value={config.estimatedDays}
            onChange={(e) => updateField('estimatedDays', e.target.value)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Регіони</h3>
            <button
              type="button"
              onClick={addRegion}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              + Додати регіон
            </button>
          </div>
          <div className="space-y-2">
            {config.regions.map((region, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={region.name}
                  onChange={(e) => updateRegion(i, 'name', e.target.value)}
                  placeholder="Назва регіону"
                />
                <Input
                  type="number"
                  value={String(region.multiplier)}
                  onChange={(e) => updateRegion(i, 'multiplier', Number(e.target.value))}
                  placeholder="Множник"
                />
                <button
                  type="button"
                  onClick={() => removeRegion(i)}
                  className="shrink-0 text-xs text-[var(--color-danger)] hover:underline"
                >
                  Видалити
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={handleSave}
        title="Зберегти налаштування доставки"
        message="Зміни набудуть чинності відразу для всіх замовлень. Продовжити?"
        confirmText="Так, зберегти"
      />
    </div>
  );
}
