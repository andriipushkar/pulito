import Link from 'next/link';
import Container from '@/components/ui/Container';
import { Telegram, Viber, Instagram, Facebook, TikTok, Phone, HelpCircle, MessageCircle } from '@/components/icons';

const socialLinks = [
  { href: 'https://t.me/poroshok_shop', label: 'Telegram', Icon: Telegram },
  { href: 'viber://pa?chatURI=poroshok_shop', label: 'Viber', Icon: Viber },
  { href: 'https://instagram.com/poroshok_shop', label: 'Instagram', Icon: Instagram },
  { href: 'https://www.facebook.com/poroshok.shop', label: 'Facebook', Icon: Facebook },
  { href: 'https://www.tiktok.com/@poroshok_shop', label: 'TikTok', Icon: TikTok },
];

export default function TopBar() {
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
          <a href="tel:+380001234567" className="inline-flex items-center gap-1 font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]">
            <Phone size={13} />
            +38 (000) 123-45-67
          </a>
          <span className="text-[var(--color-border)]">·</span>
          <span className="hidden md:inline">Пн-Пт: 9:00 - 18:00, Сб: 10:00 - 15:00</span>
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
            Безкоштовна доставка від 2000 ₴
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
