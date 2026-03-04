import Link from 'next/link';
import Container from '@/components/ui/Container';
import SubscriptionForm from './SubscriptionForm';
import { Telegram, Viber, Instagram, Facebook } from '@/components/icons';

export default function Footer() {
  return (
    <footer className="bg-[var(--color-primary-dark)] text-blue-100">
      <div className="h-1 bg-gradient-to-r from-[var(--color-primary-light)] via-[var(--color-primary)] to-[var(--color-primary-dark)]" />
      <Container className="py-14">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-2">
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-xl font-bold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-black text-white">П</span>
              Поро<span className="text-[var(--color-primary)]">шок</span>
            </Link>
            <p className="mb-5 mt-3 max-w-sm text-sm leading-relaxed text-blue-200">
              Інтернет-магазин побутової хімії та засобів для дому. Оригінальна продукція, доступні ціни, швидка доставка по Україні.
            </p>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-300">Ми в соцмережах</p>
            <div className="flex gap-3">
              <a href="https://t.me/poroshok_shop" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-blue-200 transition-all hover:bg-[var(--color-primary)] hover:text-white hover:shadow-[var(--shadow-brand)]">
                <Telegram size={20} />
              </a>
              <a href="viber://pa?chatURI=poroshok_shop" target="_blank" rel="noopener noreferrer" aria-label="Viber" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-blue-200 transition-all hover:bg-[var(--color-primary)] hover:text-white hover:shadow-[var(--shadow-brand)]">
                <Viber size={20} />
              </a>
              <a href="https://instagram.com/poroshok_shop" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-blue-200 transition-all hover:bg-[var(--color-primary)] hover:text-white hover:shadow-[var(--shadow-brand)]">
                <Instagram size={20} />
              </a>
              <a href="https://facebook.com/poroshok_shop" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-blue-200 transition-all hover:bg-[var(--color-primary)] hover:text-white hover:shadow-[var(--shadow-brand)]">
                <Facebook size={20} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Покупцям</h3>
            <ul className="flex flex-col gap-2.5 text-sm text-blue-200">
              <li><Link href="/pages/about" className="transition-colors hover:text-white">Про компанію</Link></li>
              <li><Link href="/pages/delivery" className="transition-colors hover:text-white">Доставка та оплата</Link></li>
              <li><Link href="/pages/returns" className="transition-colors hover:text-white">Повернення</Link></li>
              <li><Link href="/faq" className="transition-colors hover:text-white">Часті питання</Link></li>
              <li><Link href="/pages/wholesale-terms" className="transition-colors hover:text-white">Умови співпраці</Link></li>
              <li><Link href="/contacts" className="transition-colors hover:text-white">Контакти</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Каталог</h3>
            <ul className="flex flex-col gap-2.5 text-sm text-blue-200">
              <li><Link href="/catalog" className="transition-colors hover:text-white">Всі товари</Link></li>
              <li><Link href="/catalog?promo=true" className="transition-colors hover:text-white">Акції</Link></li>
              <li><Link href="/catalog?sort=newest" className="transition-colors hover:text-white">Новинки</Link></li>
              <li><Link href="/catalog?sort=popular" className="transition-colors hover:text-white">Популярне</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Контакти</h3>
            <ul className="flex flex-col gap-2.5 text-sm text-blue-200">
              <li>
                <a href="tel:+380001234567" className="font-medium text-white transition-colors hover:text-[var(--color-primary)]">
                  +38 (000) 123-45-67
                </a>
              </li>
              <li>Пн-Пт: 9:00 - 18:00</li>
              <li>Сб: 10:00 - 15:00</li>
              <li>
                <a href="mailto:info@poroshok.ua" className="transition-colors hover:text-white">
                  info@poroshok.ua
                </a>
              </li>
            </ul>
            <div className="mt-5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white">Підписка</h4>
              <p className="mb-2 text-xs text-blue-300">Знижки та новини на вашу пошту</p>
              <SubscriptionForm />
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-6">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-blue-300">Приймаємо оплату</p>
          <div className="mb-4 flex items-center justify-center gap-4">
            <svg viewBox="0 0 48 32" className="h-8 w-auto text-blue-300" aria-label="Visa">
              <rect width="48" height="32" rx="4" fill="currentColor" opacity="0.2"/>
              <text x="24" y="20" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="bold" fontStyle="italic">VISA</text>
            </svg>
            <svg viewBox="0 0 48 32" className="h-8 w-auto text-blue-300" aria-label="Mastercard">
              <rect width="48" height="32" rx="4" fill="currentColor" opacity="0.2"/>
              <circle cx="19" cy="16" r="8" fill="currentColor" opacity="0.25"/>
              <circle cx="29" cy="16" r="8" fill="currentColor" opacity="0.2"/>
            </svg>
            <svg viewBox="0 0 48 32" className="h-8 w-auto text-blue-300" aria-label="LiqPay">
              <rect width="48" height="32" rx="4" fill="currentColor" opacity="0.2"/>
              <text x="24" y="20" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">LiqPay</text>
            </svg>
            <svg viewBox="0 0 48 32" className="h-8 w-auto text-blue-300" aria-label="Monobank">
              <rect width="48" height="32" rx="4" fill="currentColor" opacity="0.2"/>
              <text x="24" y="20" textAnchor="middle" fill="currentColor" fontSize="7" fontWeight="bold">mono</text>
            </svg>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-blue-300">
            <span>&copy; {new Date().getFullYear()} Порошок. Всі права захищені.</span>
            <Link href="/pages/privacy-policy" className="transition-colors hover:text-white">Політика конфіденційності</Link>
            <Link href="/pages/public-offer" className="transition-colors hover:text-white">Публічна оферта</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
