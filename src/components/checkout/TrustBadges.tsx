interface BadgeProps {
  icon: React.ReactNode;
  label: string;
}

function Badge({ icon, label }: BadgeProps) {
  return (
    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
      <span className="shrink-0">{icon}</span>
      <span className="text-[11px] leading-tight">{label}</span>
    </div>
  );
}

export default function TrustBadges() {
  return (
    <div
      role="list"
      aria-label="Гарантії магазину"
      className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 sm:grid-cols-4"
    >
      <Badge
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        }
        label="SSL-шифрування"
      />
      <Badge
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        }
        label="Visa / MC / Apple Pay"
      />
      <Badge
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        }
        label="Доставка НП 1-2 дні"
      />
      <Badge
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        }
        label="Повернення 14 днів"
      />
    </div>
  );
}
