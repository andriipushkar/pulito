'use client';

import Link from 'next/link';
import Container from '@/components/ui/Container';
import { Telegram, Viber, Instagram, Facebook, TikTok, Phone, HelpCircle, MessageCircle } from '@/components/icons';
import { useSettings } from '@/hooks/useSettings';

const iconMap: Record<string, React.FC<{ size: number }>> = {
  social_telegram: Telegram,
  social_viber: Viber,
  social_instagram: Instagram,
  social_facebook: Facebook,
  social_tiktok: TikTok,
};

const socialLabels: Record<string, string> = {
  social_telegram: 'Telegram',
  social_viber: 'Viber',
  social_instagram: 'Instagram',
  social_facebook: 'Facebook',
  social_tiktok: 'TikTok',
};

const SOCIAL_KEYS = ['social_telegram', 'social_viber', 'social_instagram', 'social_facebook', 'social_tiktok'] as const;

export default function TopBar() {
  const settings = useSettings();

  const socialLinks = SOCIAL_KEYS
    .filter((key) => settings[key])
    .map((key) => ({
      href: settings[key],
      label: socialLabels[key],
      Icon: iconMap[key],
    }));

  return (
    <div className="topbar border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-secondary)]">
      {/* Mobile */}
      <Container className="flex items-center justify-between py-1.5 sm:hidden">
        <div className="flex items-center gap-2">
          <Link href="/contacts" className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-primary)]">
            <MessageCircle size={12} />
            Зв&apos;язок
          </Link>
          <span className="text-[var(--color-border)]">·</span>
          <Link href="/faq" className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-primary)]">
            <HelpCircle size={12} />
            Питання
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {socialLinks.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--color-primary)]"
              aria-label={label}
            >
              <Icon size={14} />
            </a>
          ))}
        </div>
      </Container>

      {/* Desktop */}
      <Container className="hidden items-center justify-between py-1.5 sm:flex">
        <div className="flex items-center gap-4">
          <a href={`tel:${settings.site_phone}`} className="inline-flex items-center gap-1 font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]">
            <Phone size={13} />
            {settings.site_phone_display}
          </a>
          <span className="text-[var(--color-border)]">·</span>
          <span className="hidden md:inline">{settings.working_hours}</span>
          <span className="hidden text-[var(--color-border)] md:inline">·</span>
          <Link href="/contacts" className="hidden items-center gap-1 transition-colors hover:text-[var(--color-primary)] md:inline-flex">
            <MessageCircle size={13} />
            Зворотній зв&apos;язок
          </Link>
          <span className="hidden text-[var(--color-border)] lg:inline">·</span>
          <Link href="/faq" className="hidden items-center gap-1 transition-colors hover:text-[var(--color-primary)] lg:inline-flex">
            <HelpCircle size={13} />
            Питання
          </Link>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden font-medium text-[var(--color-primary)] xl:inline">
            Безкоштовна доставка від {settings.free_delivery_threshold} ₴
          </span>
          <span className="hidden text-[var(--color-border)] xl:inline">·</span>
          {socialLinks.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--color-primary)]"
              aria-label={label}
            >
              <Icon size={15} />
            </a>
          ))}
        </div>
      </Container>
    </div>
  );
}
