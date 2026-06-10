'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import PalletDeliveryForm from '@/components/checkout/PalletDeliveryForm';
import DeliveryCostEstimate from '@/components/checkout/DeliveryCostEstimate';
import NovaPoshtaPicker from '@/components/checkout/NovaPoshtaPicker';
import UkrposhtaPicker from '@/components/checkout/UkrposhtaPicker';
import type { CheckoutInput } from '@/validators/order';
import type { DeliveryMethod } from '@/types/order';
import type { CheckoutConfig } from '@/services/checkout-config';

const DELIVERY_OPTIONS: { value: DeliveryMethod; descriptionKey: string }[] = [
  { value: 'nova_poshta', descriptionKey: 'novaPoshtaDesc' },
  { value: 'ukrposhta', descriptionKey: 'ukrposhtaDesc' },
  { value: 'pickup', descriptionKey: 'pickupDesc' },
  { value: 'pallet', descriptionKey: 'palletDesc' },
];

interface StepDeliveryProps {
  data: Partial<CheckoutInput>;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  cartTotal?: number;
  config?: CheckoutConfig | null;
}

export default function StepDelivery({
  data,
  errors,
  onChange,
  cartTotal = 0,
  config,
}: StepDeliveryProps) {
  const t = useTranslations('checkout');
  const tl = useTranslations('orderLabels');
  // Form-only state: cityRef is needed to fetch warehouses but not persisted on the order.
  const [npCityRef, setNpCityRef] = useState('');
  const [npDeliveryType, setNpDeliveryType] = useState<'warehouse' | 'address'>('warehouse');

  if (config?.delivery.manualMode) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('stepDelivery')}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Опишіть, як вам зручно отримати товар — менеджер зв&apos;яжеться і узгодить деталі.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="manual-delivery">
            Куди і як доставити? *
          </label>
          <textarea
            id="manual-delivery"
            value={data.deliveryAddress || ''}
            onChange={(e) => onChange('deliveryAddress', e.target.value)}
            placeholder="Наприклад: Нова Пошта, м. Київ, відділення №5; або самовивіз з вашого складу; або кур'єром на адресу..."
            rows={4}
            className={`rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
              errors.deliveryAddress
                ? 'border-[var(--color-danger)]'
                : 'border-[var(--color-border)]'
            } bg-[var(--color-bg)] text-[var(--color-text)]`}
          />
          {errors.deliveryAddress && (
            <p className="text-xs text-[var(--color-danger)]">{errors.deliveryAddress}</p>
          )}
        </div>
      </div>
    );
  }

  const visibleOptions = config
    ? DELIVERY_OPTIONS.filter((o) => config.delivery.available[o.value])
    : DELIVERY_OPTIONS;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('stepDelivery')}</h2>

      <div className="space-y-2">
        {visibleOptions.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-4 transition-colors ${
              data.deliveryMethod === option.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
            }`}
          >
            <input
              type="radio"
              name="deliveryMethod"
              value={option.value}
              checked={data.deliveryMethod === option.value}
              onChange={(e) => onChange('deliveryMethod', e.target.value)}
              className="mt-0.5 accent-[var(--color-primary)]"
            />
            <div>
              <span className="text-sm font-medium">{tl(`deliveryMethod.${option.value}`)}</span>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t(option.descriptionKey)}
              </p>
            </div>
          </label>
        ))}
        {errors.deliveryMethod && (
          <p className="text-xs text-[var(--color-danger)]">{errors.deliveryMethod}</p>
        )}
      </div>

      {data.deliveryMethod === 'nova_poshta' && (
        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          <NovaPoshtaPicker
            city={data.deliveryCity || ''}
            cityRef={npCityRef}
            warehouseRef={data.deliveryWarehouseRef || ''}
            warehouseLabel={data.deliveryAddress || ''}
            streetRef={data.deliveryStreetRef || ''}
            building={data.deliveryBuilding || ''}
            flat={data.deliveryFlat || ''}
            deliveryType={npDeliveryType}
            onTypeChange={(t) => {
              setNpDeliveryType(t);
              onChange('deliveryWarehouseRef', '');
              onChange('deliveryAddress', '');
              onChange('deliveryStreetRef', '');
              onChange('deliveryBuilding', '');
              onChange('deliveryFlat', '');
            }}
            errors={{
              city: errors.deliveryCity,
              warehouse: errors.deliveryAddress,
              building: errors.deliveryBuilding,
            }}
            onChange={(next) => {
              setNpCityRef(next.cityRef);
              onChange('deliveryCity', next.city);
              onChange('deliveryWarehouseRef', next.warehouseRef);
              onChange('deliveryAddress', next.warehouseLabel);
              onChange('deliveryStreetRef', next.streetRef ?? '');
              onChange('deliveryBuilding', next.building ?? '');
              onChange('deliveryFlat', next.flat ?? '');
            }}
          />
        </div>
      )}

      {data.deliveryMethod === 'ukrposhta' && (
        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          <UkrposhtaPicker
            city={data.deliveryCity || ''}
            address={data.deliveryAddress || ''}
            errors={{ city: errors.deliveryCity, address: errors.deliveryAddress }}
            onChange={(next) => {
              onChange('deliveryCity', next.city);
              onChange('deliveryAddress', next.address);
            }}
          />
        </div>
      )}

      {data.deliveryMethod === 'pickup' && config?.delivery.pickupInfo && (
        <div className="space-y-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm">
          <p className="font-semibold">Адреса самовивозу:</p>
          {config.delivery.pickupInfo.address && <p>{config.delivery.pickupInfo.address}</p>}
          {config.delivery.pickupInfo.hours && (
            <p className="text-[var(--color-text-secondary)]">
              Графік: {config.delivery.pickupInfo.hours}
            </p>
          )}
          {config.delivery.pickupInfo.phone && (
            <p className="text-[var(--color-text-secondary)]">
              Тел: {config.delivery.pickupInfo.phone}
            </p>
          )}
        </div>
      )}

      {data.deliveryMethod === 'pallet' && (
        <PalletDeliveryForm onChange={onChange} errors={errors} />
      )}

      <DeliveryCostEstimate
        deliveryMethod={data.deliveryMethod as DeliveryMethod}
        city={data.deliveryCity || ''}
        cartTotal={cartTotal}
      />
    </div>
  );
}
