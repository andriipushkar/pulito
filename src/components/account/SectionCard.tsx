import type { ReactNode } from 'react';

interface SectionCardProps {
  icon?: ReactNode;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function SectionCard({ icon, title, actions, children, className = '', noPadding }: SectionCardProps) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] shadow-sm ${className}`}>
      {(icon || title || actions) && (
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
            {icon}
            {title && <h3 className="text-sm font-bold text-[var(--color-text)]">{title}</h3>}
          </div>
          {actions}
        </div>
      )}
      {noPadding ? children : <div className="p-5">{children}</div>}
    </div>
  );
}
