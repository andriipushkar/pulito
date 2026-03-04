import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  iconBg?: string;
  trend?: { value: string; positive?: boolean };
}

export default function StatCard({ label, value, subtitle, icon, iconBg = 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]', trend }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--color-text)]">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
