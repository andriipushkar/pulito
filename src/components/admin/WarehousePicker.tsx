'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

interface CityResult {
  Ref: string;
  MainDescription: string;
  DeliveryCity: string;
  Present: string;
}
interface WarehouseResult {
  Ref: string;
  Description: string;
}

interface WarehousePickerProps {
  /** Called with the selected warehouse Ref (or '' when cleared). */
  onSelect: (warehouseRef: string, label: string) => void;
}

/**
 * Reusable Nova Poshta city → warehouse picker. Debounced search against the
 * public delivery endpoints. Used by the parcel-redirect flow (and reusable
 * anywhere a destination warehouse Ref is needed).
 */
export default function WarehousePicker({ onSelect }: WarehousePickerProps) {
  const t = useTranslations('admin.createTtnForm');

  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<CityResult[]>([]);
  const [cityRef, setCityRef] = useState('');
  const [showCities, setShowCities] = useState(false);

  const [whQuery, setWhQuery] = useState('');
  const [warehouses, setWarehouses] = useState<WarehouseResult[]>([]);
  const [showWh, setShowWh] = useState(false);

  const cityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const whTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (cityQuery.length < 2 || cityRef) return;
    clearTimeout(cityTimer.current);
    cityTimer.current = setTimeout(async () => {
      const res = await apiClient.get(`/api/v1/delivery/cities?q=${encodeURIComponent(cityQuery)}`);
      if (res.success && res.data) {
        const data = res.data as unknown as { Addresses?: CityResult[] }[];
        const addresses = data[0]?.Addresses || (res.data as unknown as CityResult[]);
        setCities(Array.isArray(addresses) ? addresses : []);
        setShowCities(true);
      }
    }, 300);
    return () => clearTimeout(cityTimer.current);
  }, [cityQuery, cityRef]);

  useEffect(() => {
    if (!cityRef) return;
    clearTimeout(whTimer.current);
    whTimer.current = setTimeout(async () => {
      const q = whQuery ? `&q=${encodeURIComponent(whQuery)}` : '';
      const res = await apiClient.get(`/api/v1/delivery/warehouses?cityRef=${cityRef}${q}`);
      if (res.success && res.data) {
        setWarehouses(res.data as unknown as WarehouseResult[]);
        if (whQuery) setShowWh(true);
      }
    }, 300);
    return () => clearTimeout(whTimer.current);
  }, [cityRef, whQuery]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <label className="mb-1 block text-xs font-medium">{t('cityLabel')}</label>
        <input
          value={cityQuery}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setCityRef('');
            onSelect('', '');
          }}
          placeholder={t('citySearchPlaceholder')}
          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
        />
        {showCities && cities.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
            {cities.map((c, i) => (
              <button
                key={i}
                onClick={() => {
                  setCityQuery(c.Present || c.MainDescription);
                  setCityRef(c.DeliveryCity || c.Ref);
                  setShowCities(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
              >
                {c.Present || c.MainDescription}
              </button>
            ))}
          </div>
        )}
      </div>

      {cityRef && (
        <div className="relative">
          <label className="mb-1 block text-xs font-medium">{t('warehouseLabel')}</label>
          <input
            value={whQuery}
            onChange={(e) => {
              setWhQuery(e.target.value);
              onSelect('', '');
            }}
            placeholder={t('warehouseSearchPlaceholder')}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
          />
          {showWh && warehouses.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
              {warehouses.map((w) => (
                <button
                  key={w.Ref}
                  onClick={() => {
                    setWhQuery(w.Description);
                    setShowWh(false);
                    onSelect(w.Ref, w.Description);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                >
                  {w.Description}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
