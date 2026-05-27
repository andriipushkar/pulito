'use client';

import { Link } from '@/i18n/navigation';
import { useSettings } from '@/hooks/useSettings';

interface SiteLogoProps {
  href?: string;
  className?: string;
}

export default function SiteLogo({ href = '/', className = '' }: SiteLogoProps) {
  const settings = useSettings();

  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 text-xl font-bold tracking-tight text-[var(--color-text)] sm:gap-2 ${className}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-sm font-extrabold text-white shadow-[var(--shadow-brand)]">
        {settings.site_name.charAt(0)}
      </span>
      <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] bg-clip-text text-transparent">
        {settings.site_name}
      </span>
    </Link>
  );
}
