import Container from '@/components/ui/Container';
import { Telegram, Viber, Instagram } from '@/components/icons';
import LanguageSwitcher from './LanguageSwitcher';

export default function TopBar() {
  return (
    <div className="topbar hidden border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-secondary)] sm:block">
      <Container className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-4">
          <a href="tel:+380001234567" className="font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]">
            +38 (000) 123-45-67
          </a>
          <span className="text-[var(--color-border)]">·</span>
          <a href="mailto:info@poroshok.ua" className="transition-colors hover:text-[var(--color-primary)]">
            info@poroshok.ua
          </a>
          <span className="hidden text-[var(--color-border)] md:inline">·</span>
          <span className="hidden md:inline">Пн-Пт: 9:00 - 18:00, Сб: 10:00 - 15:00</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-medium text-[var(--color-primary)] lg:inline">
            Безкоштовна доставка від 2000 ₴
          </span>
          <span className="hidden text-[var(--color-border)] lg:inline">·</span>
          <a href="https://t.me/poroshok_shop" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--color-primary)]" aria-label="Telegram">
            <Telegram size={16} />
          </a>
          <a href="viber://pa?chatURI=poroshok_shop" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--color-primary)]" aria-label="Viber">
            <Viber size={16} />
          </a>
          <a href="https://instagram.com/poroshok_shop" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--color-primary)]" aria-label="Instagram">
            <Instagram size={16} />
          </a>
          <LanguageSwitcher />
        </div>
      </Container>
    </div>
  );
}
