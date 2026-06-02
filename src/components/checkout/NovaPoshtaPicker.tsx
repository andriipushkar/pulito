'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useDebounce } from '@/hooks/useDebounce';

interface City {
  Ref: string;
  Description: string;
  AreaDescription?: string;
  RegionsDescription?: string;
  SettlementTypeDescription?: string;
  MainDescription?: string;
}

interface Warehouse {
  Ref: string;
  Description: string;
  Number?: string;
  ShortAddress?: string;
}

type DeliveryType = 'warehouse' | 'address';

interface Street {
  Ref: string;
  Description: string;
  StreetsType?: string;
}

interface NovaPoshtaPickerProps {
  city: string;
  cityRef: string;
  warehouseRef: string;
  warehouseLabel: string;
  streetRef?: string;
  building?: string;
  flat?: string;
  /** 'warehouse' = відділення/поштомат; 'address' = кур&apos;єр на адресу. */
  deliveryType?: DeliveryType;
  onTypeChange?: (t: DeliveryType) => void;
  onChange: (next: {
    city: string;
    cityRef: string;
    warehouseRef: string;
    warehouseLabel: string;
    streetRef?: string;
    building?: string;
    flat?: string;
  }) => void;
  errors?: { city?: string; warehouse?: string; building?: string };
}

export default function NovaPoshtaPicker({
  city,
  cityRef,
  warehouseRef,
  warehouseLabel,
  streetRef = '',
  building = '',
  flat = '',
  deliveryType = 'warehouse',
  onTypeChange,
  onChange,
  errors,
}: NovaPoshtaPickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onTypeChange?.('warehouse')}
          className={`flex-1 rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors ${
            deliveryType === 'warehouse'
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 font-medium'
              : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
          }`}
        >
          📦 Відділення / поштомат
        </button>
        <button
          type="button"
          onClick={() => onTypeChange?.('address')}
          className={`flex-1 rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors ${
            deliveryType === 'address'
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 font-medium'
              : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
          }`}
        >
          🚚 Адресна (кур&apos;єр)
        </button>
      </div>

      <CityCombobox
        city={city}
        cityRef={cityRef}
        error={errors?.city}
        onSelect={(c) =>
          onChange({
            city: c.Description,
            cityRef: c.Ref,
            warehouseRef: '',
            warehouseLabel: '',
          })
        }
        onClear={() => onChange({ city: '', cityRef: '', warehouseRef: '', warehouseLabel: '' })}
      />

      {deliveryType === 'address' ? (
        cityRef ? (
          <div className="space-y-3">
            <StreetCombobox
              cityRef={cityRef}
              streetRef={streetRef}
              streetLabel={warehouseLabel}
              error={errors?.warehouse}
              onSelect={(s) =>
                onChange({
                  city,
                  cityRef,
                  warehouseRef: '',
                  warehouseLabel: s.Description,
                  streetRef: s.Ref,
                  building,
                  flat,
                })
              }
              onClear={() =>
                onChange({
                  city,
                  cityRef,
                  warehouseRef: '',
                  warehouseLabel: '',
                  streetRef: '',
                  building,
                  flat,
                })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  Будинок *
                </label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) =>
                    onChange({
                      city,
                      cityRef,
                      warehouseRef: '',
                      warehouseLabel,
                      streetRef,
                      building: e.target.value,
                      flat,
                    })
                  }
                  placeholder="1"
                  className={`w-full rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
                    errors?.building
                      ? 'border-[var(--color-danger)]'
                      : 'border-[var(--color-border)]'
                  } bg-[var(--color-bg)] text-[var(--color-text)]`}
                />
                {errors?.building && (
                  <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.building}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  Квартира
                </label>
                <input
                  type="text"
                  value={flat}
                  onChange={(e) =>
                    onChange({
                      city,
                      cityRef,
                      warehouseRef: '',
                      warehouseLabel,
                      streetRef,
                      building,
                      flat: e.target.value,
                    })
                  }
                  placeholder="5"
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Кур&apos;єр НП доставить на цю адресу. Точну вартість порахує менеджер.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-secondary)]">Спочатку оберіть місто</p>
        )
      ) : cityRef ? (
        <WarehouseCombobox
          cityRef={cityRef}
          warehouseRef={warehouseRef}
          warehouseLabel={warehouseLabel}
          error={errors?.warehouse}
          onSelect={(w) =>
            onChange({
              city,
              cityRef,
              warehouseRef: w.Ref,
              warehouseLabel: w.Description,
            })
          }
          onClear={() => onChange({ city, cityRef, warehouseRef: '', warehouseLabel: '' })}
        />
      ) : (
        <p className="text-xs text-[var(--color-text-secondary)]">Спочатку оберіть місто</p>
      )}

      {cityRef && (
        <DeliveryEtaHint
          cityRef={cityRef}
          serviceType={deliveryType === 'address' ? 'WarehouseDoors' : 'WarehouseWarehouse'}
        />
      )}
    </div>
  );
}

/**
 * Shows the estimated Nova Poshta delivery date for the chosen city, via the
 * lightweight /delivery/delivery-date endpoint (getDocumentDeliveryDate).
 */
function DeliveryEtaHint({
  cityRef,
  serviceType,
}: {
  cityRef: string;
  serviceType: 'WarehouseWarehouse' | 'WarehouseDoors';
}) {
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ deliveryDate: string | null }>(
        `/api/v1/delivery/delivery-date?city=${cityRef}&serviceType=${serviceType}`,
      )
      .then((res) => {
        if (cancelled) return;
        setEta(res.success && res.data?.deliveryDate ? res.data.deliveryDate.split(' ')[0] : null);
      })
      .catch(() => {
        if (!cancelled) setEta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cityRef, serviceType]);

  if (!eta) return null;
  return (
    <p className="rounded-[var(--radius)] bg-[var(--color-primary)]/5 px-3 py-2 text-xs text-[var(--color-text-secondary)]">
      📅 Орієнтовна дата доставки:{' '}
      <span className="font-medium text-[var(--color-text)]">{eta}</span>
    </p>
  );
}

function CityCombobox({
  city,
  cityRef,
  error,
  onSelect,
  onClear,
}: {
  city: string;
  cityRef: string;
  error?: string;
  onSelect: (c: City) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(city);
  const [results, setResults] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounced = useDebounce(query, 250);

  // Sync with parent value (e.g. restoring saved checkout state)
  useEffect(() => {
    setQuery(city);
  }, [city]);

  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length < 2 || trimmed === city) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<City[]>(`/api/v1/delivery/cities?q=${encodeURIComponent(trimmed)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) setResults(res.data.slice(0, 12));
        else setResults([]);
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, city]);

  // Close on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Місто *</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (cityRef) onClear();
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Почніть вводити: Київ, Львів..."
          autoComplete="off"
          className={`w-full rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
          } bg-[var(--color-bg)] text-[var(--color-text)]`}
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary)]">
            ...
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg"
        >
          {results.map((c) => (
            <li
              key={c.Ref}
              role="option"
              aria-selected={false}
              tabIndex={-1}
              onClick={() => {
                setQuery(c.Description);
                setIsOpen(false);
                onSelect(c);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              <span className="font-medium">{c.Description}</span>
              {c.AreaDescription && (
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                  {c.AreaDescription}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StreetCombobox({
  cityRef,
  streetRef,
  streetLabel,
  error,
  onSelect,
  onClear,
}: {
  cityRef: string;
  streetRef: string;
  streetLabel: string;
  error?: string;
  onSelect: (s: Street) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(streetLabel);
  const [results, setResults] = useState<Street[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounced = useDebounce(query, 250);
  const prevCityRef = useRef(cityRef);

  useEffect(() => {
    if (prevCityRef.current && cityRef !== prevCityRef.current) {
      setQuery('');
      setResults([]);
    }
    prevCityRef.current = cityRef;
  }, [cityRef]);

  useEffect(() => {
    setQuery(streetLabel);
  }, [streetLabel]);

  useEffect(() => {
    const trimmed = debounced.trim();
    if (!cityRef || trimmed.length < 2 || trimmed === streetLabel) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams({ cityRef, q: trimmed });
    apiClient
      .get<Street[]>(`/api/v1/delivery/streets?${params}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) setResults(res.data.slice(0, 15));
        else setResults([]);
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, cityRef, streetLabel]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Вулиця *</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (streetRef) onClear();
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Хрещатик, Мазепи..."
          autoComplete="off"
          className={`w-full rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
          } bg-[var(--color-bg)] text-[var(--color-text)]`}
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary)]">
            ...
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      {isOpen && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
          {results.map((s) => (
            <li
              key={s.Ref}
              onClick={() => {
                setIsOpen(false);
                onSelect(s);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              {s.StreetsType && (
                <span className="mr-1 text-xs text-[var(--color-text-secondary)]">
                  {s.StreetsType}.
                </span>
              )}
              <span>{s.Description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WarehouseCombobox({
  cityRef,
  warehouseRef,
  warehouseLabel,
  error,
  onSelect,
  onClear,
}: {
  cityRef: string;
  warehouseRef: string;
  warehouseLabel: string;
  error?: string;
  onSelect: (w: Warehouse) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(warehouseLabel);
  const [results, setResults] = useState<Warehouse[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounced = useDebounce(query, 250);
  const prevCityRef = useRef(cityRef);

  // Reset only when user actually changes city (not on initial mount).
  useEffect(() => {
    if (prevCityRef.current && cityRef !== prevCityRef.current) {
      setQuery('');
      setResults([]);
    }
    prevCityRef.current = cityRef;
  }, [cityRef]);

  // Sync with parent
  useEffect(() => {
    setQuery(warehouseLabel);
  }, [warehouseLabel]);

  useEffect(() => {
    if (!cityRef) return;
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams({ cityRef });
    const trimmed = debounced.trim();
    if (trimmed && trimmed !== warehouseLabel) params.set('q', trimmed);
    apiClient
      .get<Warehouse[]>(`/api/v1/delivery/warehouses?${params}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) setResults(res.data.slice(0, 25));
        else setResults([]);
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, cityRef, warehouseLabel]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
        Відділення / Поштомат *
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (warehouseRef) onClear();
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="№ відділення або вулиця"
          autoComplete="off"
          className={`w-full rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
          } bg-[var(--color-bg)] text-[var(--color-text)]`}
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary)]">
            ...
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg"
        >
          {results.map((w) => (
            <li
              key={w.Ref}
              role="option"
              aria-selected={false}
              tabIndex={-1}
              onClick={() => {
                setQuery(w.Description);
                setIsOpen(false);
                onSelect(w);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              {w.Number && (
                <span className="mr-2 inline-block rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                  №{w.Number}
                </span>
              )}
              <span>{w.Description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
