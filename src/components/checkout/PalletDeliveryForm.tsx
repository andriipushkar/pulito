'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';

interface PalletDeliveryFormProps {
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

interface PalletCostResult {
  cost: number;
  estimatedDays: string;
  isFreeDelivery: boolean;
}

export default function PalletDeliveryForm({ onChange, errors }: PalletDeliveryFormProps) {
  const [weightKg, setWeightKg] = useState('');
  const [region, setRegion] = useState('');
  const [result, setResult] = useState<PalletCostResult | null>(null);
  const [calcError, setCalcError] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);

  const REGIONS = [
    'Київ та область',
    'Центральна Україна',
    'Захід',
    'Схід',
    'Південь',
  ];

  // Result and error are cleared when the user initiates a new calculation via handleCalculate

  const handleCalculate = async () => {
    const weight = Number(weightKg);
    if (!weight || weight <= 0) {
      setCalcError('Введіть вагу');
      return;
    }

    setIsCalculating(true);
    setCalcError('');

    const res = await apiClient.post<PalletCostResult>('/api/v1/delivery/pallet/calculate', {
      weightKg: weight,
      region: region || undefined,
    });

    setIsCalculating(false);

    if (res.success && res.data) {
      setResult(res.data);
      onChange('palletWeightKg', weightKg);
      onChange('palletRegion', region);
      onChange('palletDeliveryCost', String(res.data.cost));
    } else {
      setCalcError(res.error || 'Помилка розрахунку');
    }
  };

  return (
    <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
      <h3 className="text-sm font-semibold">Палетна доставка</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Вага замовлення (кг) *"
          type="number"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          error={errors.palletWeightKg}
          placeholder="100"
        />

        <div>
          <label className="mb-1 block text-sm font-medium">Регіон</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="">Оберіть регіон</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCalculate}
        disabled={isCalculating}
        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isCalculating ? 'Розраховуємо...' : 'Розрахувати вартість'}
      </button>

      {calcError && (
        <p className="text-xs text-[var(--color-danger)]">{calcError}</p>
      )}

      {result && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Вартість доставки: <strong>{result.isFreeDelivery ? 'Безкоштовно' : `${result.cost} грн`}</strong>
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Орієнтовний термін: {result.estimatedDays} робочих днів
              </p>
            </div>
          </div>
        </div>
      )}

      <Input
        label="Адреса доставки *"
        value=""
        onChange={(e) => onChange('deliveryAddress', e.target.value)}
        error={errors.deliveryAddress}
        placeholder="Адреса складу або підприємства"
      />

      <Input
        label="Місто *"
        value=""
        onChange={(e) => onChange('deliveryCity', e.target.value)}
        error={errors.deliveryCity}
        placeholder="Київ"
      />
    </div>
  );
}
