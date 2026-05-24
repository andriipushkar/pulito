'use client';

import { useEffect, useState } from 'react';

interface Spec {
  key: string;
  value: string;
}

interface Props {
  /** Raw string from the DB. Supports two formats:
   *  - JSON array: `[{"key":"...","value":"..."}, ...]`
   *  - Legacy free-text: each non-empty line "Key: Value"
   *  When saving we always emit JSON. */
  value: string;
  onChange: (next: string) => void;
}

function parse(raw: string): Spec[] {
  if (!raw || !raw.trim()) return [];
  // Try JSON first
  if (raw.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'object' && x && 'key' in x)) {
        return arr.map((x) => ({ key: String(x.key ?? ''), value: String(x.value ?? '') }));
      }
    } catch {
      // fall through to text mode
    }
  }
  // Legacy: strip HTML tags then split lines on "Key: Value"
  const text = raw
    .replace(/<br\s*\/?>(?=\S)/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { key: line, value: '' };
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
}

function serialize(specs: Spec[]): string {
  const cleaned = specs.filter((s) => s.key.trim() || s.value.trim());
  return cleaned.length ? JSON.stringify(cleaned) : '';
}

export default function SpecsEditor({ value, onChange }: Props) {
  const [specs, setSpecs] = useState<Spec[]>(() => parse(value));

  // Re-parse only when the upstream value changes from outside (e.g. data load)
  useEffect(() => {
    setSpecs(parse(value));
  }, [value]);

  const emit = (next: Spec[]) => {
    setSpecs(next);
    onChange(serialize(next));
  };

  const update = (i: number, patch: Partial<Spec>) => {
    emit(specs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const add = () => emit([...specs, { key: '', value: '' }]);
  const remove = (i: number) => emit(specs.filter((_, idx) => idx !== i));

  return (
    <div>
      {specs.length === 0 ? (
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          Немає характеристик. Додайте, щоб клієнти бачили структурований опис: «Об&apos;єм: 5 л»,
          «Торгова марка: Ariel» тощо.
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {specs.map((s, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-md bg-[var(--color-bg-secondary)]/40 p-2"
            >
              <input
                type="text"
                value={s.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="Назва (напр. Об'єм)"
                className="w-44 flex-shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
              <span className="text-[var(--color-text-secondary)]">:</span>
              <input
                type="text"
                value={s.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Значення (напр. 5 л)"
                className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label="Видалити характеристику"
                title="Видалити"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Додати характеристику
      </button>
    </div>
  );
}
