'use client';

const OPTIONS = [10, 20, 50, 100];

interface PageSizeSelectorProps {
  value: number;
  onChange: (size: number) => void;
}

export default function PageSizeSelector({ value, onChange }: PageSizeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
      <span>Показувати:</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-1 text-xs"
        aria-label="Кількість на сторінці"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}
