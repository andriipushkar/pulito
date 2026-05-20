'use client';

import { useState } from 'react';

const FREQUENCY_OPTIONS: { value: SubscriptionFrequency; label: string; days: number }[] = [
  { value: 'weekly', label: 'Кожні 7 днів', days: 7 },
  { value: 'biweekly', label: 'Кожні 14 днів', days: 14 },
  { value: 'monthly', label: 'Кожні 30 днів', days: 30 },
  { value: 'bimonthly', label: 'Кожні 60 днів', days: 60 },
];

export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly';

interface SubscriptionToggleProps {
  enabled: boolean;
  frequency: SubscriptionFrequency;
  /** Discount percent (e.g., 5) — used for inline preview only. */
  discountPercent: number;
  onChange: (next: { enabled: boolean; frequency: SubscriptionFrequency }) => void;
}

export default function SubscriptionToggle({
  enabled,
  frequency,
  discountPercent,
  onChange,
}: SubscriptionToggleProps) {
  const [open, setOpen] = useState(enabled);

  const toggleEnabled = () => {
    const next = !enabled;
    onChange({ enabled: next, frequency });
    setOpen(next);
  };

  if (!open && !enabled) {
    return (
      <button
        type="button"
        onClick={toggleEnabled}
        className="text-[11px] text-[var(--color-primary)] hover:underline"
      >
        🔄 Підписка з –{discountPercent}%
      </button>
    );
  }

  return (
    <div className="rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-2">
      <label className="mb-1 flex items-center gap-2 text-[11px] font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggleEnabled}
          className="accent-[var(--color-primary)]"
        />
        Підписка з –{discountPercent}%
      </label>
      {enabled && (
        <select
          value={frequency}
          onChange={(e) =>
            onChange({ enabled, frequency: e.target.value as SubscriptionFrequency })
          }
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px]"
          aria-label="Частота підписки"
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
