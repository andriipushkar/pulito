import Container from '@/components/ui/Container';
import LanguageSwitcher from './LanguageSwitcher';

export default function TopBar() {
  return (
    <div className="hidden border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-secondary)] sm:block">
      <Container className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-4">
          <a href="tel:+380001234567" className="font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]">
            +38 (000) 123-45-67
          </a>
          <span className="hidden md:inline">Пн-Пт: 9:00 - 18:00, Сб: 10:00 - 15:00</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#" className="transition-colors hover:text-[var(--color-primary)]" aria-label="Telegram">
            Telegram
          </a>
          <a href="#" className="transition-colors hover:text-[var(--color-primary)]" aria-label="Viber">
            Viber
          </a>
          <a href="#" className="transition-colors hover:text-[var(--color-primary)]" aria-label="Instagram">
            Instagram
          </a>
          <LanguageSwitcher />
        </div>
      </Container>
    </div>
  );
}
