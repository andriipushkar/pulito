'use client';

import Link from 'next/link';
import Container from '@/components/ui/Container';
import SubscriptionForm from './SubscriptionForm';
import { Telegram, Viber, Instagram, Facebook, TikTok } from '@/components/icons';
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

const buyerLinks = [
  { href: '/pages/about', label: 'Про компанію' },
  { href: '/pages/delivery', label: 'Доставка та оплата' },
  { href: '/pages/returns', label: 'Повернення' },
  { href: '/faq', label: 'Часті питання' },
  { href: '/pages/cooperation', label: 'Умови співпраці' },
  { href: '/contacts', label: 'Контакти' },
];

const catalogLinks = [
  { href: '/catalog', label: 'Всі товари' },
  { href: '/catalog?promo=true', label: 'Акції' },
  { href: '/catalog?sort=newest', label: 'Новинки' },
  { href: '/bundles', label: 'Комплекти' },
  { href: '/blog', label: 'Блог' },
  { href: '/calculator', label: 'Калькулятор' },
];

export default function Footer() {
  const settings = useSettings();

  const socialLinks = SOCIAL_KEYS
    .filter((key) => settings[key])
    .map((key) => ({
      href: settings[key],
      label: socialLabels[key],
      Icon: iconMap[key],
    }));

  return (
    <footer className="bg-[var(--color-text)] text-white/70">
      <Container className="py-8 lg:py-10">
        {/* Mobile */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-1.5 text-lg font-bold text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-black text-white">П</span>
              Поро<span className="text-[var(--color-primary)]">шок</span>
            </Link>
            <div className="flex gap-2">
              {socialLinks.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/60 transition-colors hover:bg-[var(--color-primary)] hover:text-white">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Покупцям</h3>
              <ul className="flex flex-col gap-1.5">
                {buyerLinks.map(({ href, label }) => (
                  <li key={href}><Link href={href} className="text-[13px] transition-colors hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Каталог</h3>
              <ul className="flex flex-col gap-1.5">
                {catalogLinks.map(({ href, label }) => (
                  <li key={href}><Link href={href} className="text-[13px] transition-colors hover:text-white">{label}</Link></li>
                ))}
              </ul>
              <div className="mt-4">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Контакти</h3>
                <a href={`tel:${settings.site_phone}`} className="text-[13px] font-medium text-white">{settings.site_phone_display}</a>
                <p className="text-[11px] text-white/40">{settings.working_hours}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white/5 p-4">
            <p className="mb-2 text-xs font-semibold text-white/60">Знижки та новини на пошту</p>
            <SubscriptionForm />
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden items-start gap-10 lg:flex xl:gap-14">
          <div className="w-[220px] shrink-0">
            <Link href="/" className="inline-flex items-center gap-1.5 text-lg font-bold text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-black text-white">П</span>
              Поро<span className="text-[var(--color-primary)]">шок</span>
            </Link>
            <p className="mt-2 text-xs leading-relaxed text-white/50">
              {settings.company_description}
            </p>
            <h4 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/40">Ми в соцмережах</h4>
            <div className="flex gap-2">
              {socialLinks.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/50 transition-all hover:bg-[var(--color-primary)] hover:text-white">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Покупцям</h3>
            <ul className="flex flex-col gap-1.5">
              {buyerLinks.map(({ href, label }) => (
                <li key={href}><Link href={href} className="text-[13px] transition-colors hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Каталог</h3>
            <ul className="flex flex-col gap-1.5">
              {catalogLinks.map(({ href, label }) => (
                <li key={href}><Link href={href} className="text-[13px] transition-colors hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Контакти</h3>
            <a href={`tel:${settings.site_phone}`} className="text-sm font-medium text-white transition-colors hover:text-[var(--color-primary)]">{settings.site_phone_display}</a>
            <p className="mt-1 text-xs text-white/40">{settings.working_hours}</p>
            <a href={`mailto:${settings.site_email}`} className="mt-1.5 block text-xs transition-colors hover:text-white">{settings.site_email}</a>
          </div>

          <div className="ml-auto w-[220px] shrink-0">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Підписка</h3>
            <p className="mb-2 text-xs text-white/50">Знижки та новини на вашу пошту</p>
            <SubscriptionForm />
          </div>
        </div>
      </Container>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="mr-1 text-[11px] text-white/30">Приймаємо:</span>
            {[
              { name: 'VISA', bg: 'bg-[#1A1F71]' },
              { name: 'MC', bg: 'bg-[#EB001B]' },
              { name: 'LiqPay', bg: 'bg-[#7AB72B]' },
              { name: 'mono', bg: 'bg-[#000000]' },
            ].map(({ name, bg }) => (
              <span key={name} className={`${bg} rounded px-2 py-0.5 text-[10px] font-semibold text-white/80`}>{name}</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/30">
            <span>&copy; {new Date().getFullYear()} {settings.site_name}. Всі права захищені.</span>
            <Link href="/pages/privacy-policy" className="transition-colors hover:text-white/60">Політика конфіденційності</Link>
            <Link href="/pages/public-offer" className="transition-colors hover:text-white/60">Публічна оферта</Link>
          </div>
        </Container>
      </div>

      {/* Mobile bottom nav spacer */}
      <div className="h-20 lg:hidden" />
    </footer>
  );
}
