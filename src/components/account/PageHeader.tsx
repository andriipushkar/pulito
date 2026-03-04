import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}

export default function PageHeader({ icon, title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-bold text-[var(--color-text)]">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
