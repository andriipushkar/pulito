interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

const defaultColors: Record<string, string> = {
  promo: 'bg-gradient-to-r from-[var(--color-gold-dark)] to-[var(--color-gold)] text-white',
  new_arrival: 'bg-[#2196F3] text-white',
  hit: 'bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-light)] text-white',
  eco: 'bg-[#4CAF50] text-white',
  custom: 'bg-[#FF9800] text-white',
};

export default function Badge({ children, color, className = '' }: BadgeProps) {
  const colorClass = color
    ? ''
    : defaultColors[String(children).toLowerCase()] || 'bg-gray-600 text-white';

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colorClass} ${className}`}
      style={color ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {children}
    </span>
  );
}
