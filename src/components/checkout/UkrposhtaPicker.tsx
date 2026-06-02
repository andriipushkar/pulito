'use client';

import { useEffect, useRef, useState } from 'react';
import Input from '@/components/ui/Input';
import { apiClient } from '@/lib/api-client';
import { useDebounce } from '@/hooks/useDebounce';

interface UkrCity {
  name: string;
  postcode: string;
  region: string;
  cityId: string;
}

interface UkrPostOffice {
  postcode: string;
  name: string;
  address: string;
  type: string;
}

interface UkrposhtaPickerProps {
  city: string;
  address: string;
  onChange: (next: { city: string; address: string }) => void;
  errors?: { city?: string; address?: string };
}

export default function UkrposhtaPicker({ city, address, onChange, errors }: UkrposhtaPickerProps) {
  // Two delivery shapes: pick a post office (відділення) by city, or type a
  // courier address. Default to відділення — the most common Ukrposhta flow.
  const [mode, setMode] = useState<'warehouse' | 'address'>('warehouse');
  const [cityId, setCityId] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ModeButton active={mode === 'warehouse'} onClick={() => setMode('warehouse')}>
          У відділення
        </ModeButton>
        <ModeButton active={mode === 'address'} onClick={() => setMode('address')}>
          Кур&apos;єром на адресу
        </ModeButton>
      </div>

      <CityCombobox
        city={city}
        error={errors?.city}
        onSelect={(c) => {
          setCityId(c.cityId);
          // Reset the chosen office/address when the city changes.
          onChange({ city: `${c.name}${c.region ? `, ${c.region}` : ''}`, address: '' });
        }}
        onClear={() => {
          setCityId('');
          onChange({ city: '', address: '' });
        }}
      />

      {mode === 'warehouse' ? (
        <PostOfficePicker
          cityId={cityId}
          value={address}
          error={errors?.address}
          onSelect={(o) =>
            onChange({
              city,
              address: `${o.name}${o.address ? `, ${o.address}` : ''} (${o.postcode})`,
            })
          }
        />
      ) : (
        <Input
          label="Адреса (вулиця, будинок, кв.) *"
          value={address}
          onChange={(e) => onChange({ city, address: e.target.value })}
          error={errors?.address}
          placeholder="вул. Хрещатик, 1, кв. 5"
        />
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius)] border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50'
      }`}
    >
      {children}
    </button>
  );
}

function PostOfficePicker({
  cityId,
  value,
  error,
  onSelect,
}: {
  cityId: string;
  value: string;
  error?: string;
  onSelect: (o: UkrPostOffice) => void;
}) {
  const [offices, setOffices] = useState<UkrPostOffice[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!cityId) {
      setOffices([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<UkrPostOffice[]>(
        `/api/v1/delivery/ukrposhta-warehouses?cityId=${encodeURIComponent(cityId)}`,
      )
      .then((res) => {
        if (cancelled) return;
        setOffices(res.success && Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => !cancelled && setOffices([]))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  if (!cityId) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Спочатку оберіть місто, щоб побачити відділення.
      </p>
    );
  }

  const filtered = filter.trim()
    ? offices.filter(
        (o) =>
          o.name.toLowerCase().includes(filter.toLowerCase()) ||
          o.address.toLowerCase().includes(filter.toLowerCase()) ||
          o.postcode.includes(filter),
      )
    : offices;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--color-text)]">Відділення *</label>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Пошук за номером, адресою або індексом"
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Завантаження відділень...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Відділень не знайдено.</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          {filtered.slice(0, 50).map((o) => {
            const label = `${o.name}${o.address ? `, ${o.address}` : ''} (${o.postcode})`;
            const selected = value === label;
            return (
              <li
                key={`${o.postcode}-${o.name}`}
                onClick={() => onSelect(o)}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)] ${
                  selected ? 'bg-[var(--color-primary)]/10' : ''
                }`}
              >
                <span className="font-medium">{o.name}</span>
                {o.address && (
                  <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                    {o.address}
                  </span>
                )}
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                  {o.postcode}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CityCombobox({
  city,
  error,
  onSelect,
  onClear,
}: {
  city: string;
  error?: string;
  onSelect: (c: UkrCity) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(city);
  const [results, setResults] = useState<UkrCity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounced = useDebounce(query, 300);

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
      .get<UkrCity[]>(`/api/v1/delivery/ukrposhta-cities?q=${encodeURIComponent(trimmed)}`)
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
            if (city) onClear();
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Київ, Львів..."
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
          {results.map((c) => (
            <li
              key={`${c.name}-${c.postcode}-${c.cityId}`}
              onClick={() => {
                setIsOpen(false);
                onSelect(c);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                {c.postcode}
                {c.region && ` · ${c.region}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
