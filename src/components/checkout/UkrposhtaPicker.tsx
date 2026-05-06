'use client';

import { useEffect, useRef, useState } from 'react';
import Input from '@/components/ui/Input';
import { apiClient } from '@/lib/api-client';
import { useDebounce } from '@/hooks/useDebounce';

interface UkrCity {
  name: string;
  postcode: string;
  region: string;
}

interface UkrposhtaPickerProps {
  city: string;
  address: string;
  onChange: (next: { city: string; address: string }) => void;
  errors?: { city?: string; address?: string };
}

export default function UkrposhtaPicker({ city, address, onChange, errors }: UkrposhtaPickerProps) {
  return (
    <div className="space-y-4">
      <CityCombobox
        city={city}
        error={errors?.city}
        onSelect={(c) => onChange({ city: `${c.name} (${c.postcode})`, address })}
        onClear={() => onChange({ city: '', address })}
      />
      <Input
        label="Адреса (вулиця, будинок, кв.) *"
        value={address}
        onChange={(e) => onChange({ city, address: e.target.value })}
        error={errors?.address}
        placeholder="вул. Хрещатик, 1, кв. 5"
      />
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
              key={`${c.name}-${c.postcode}`}
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
