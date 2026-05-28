'use client';

import { useTranslations } from 'next-intl';

interface UsageMeterProps {
  label: string;
  used: number;
  max: number;
}

export default function UsageMeter({ label, used, max }: UsageMeterProps) {
  const t = useTranslations('admin.usageMeter');
  const percent = max > 0 ? Math.min((used / max) * 100, 100) : 0;

  const barColor = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  const textColor =
    percent >= 90 ? 'text-red-600' : percent >= 70 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        <span className={`text-sm font-semibold ${textColor}`}>
          {used}/{max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        {t('usedPercent', { percent: percent.toFixed(0) })}
      </p>
    </div>
  );
}
