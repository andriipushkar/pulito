import Link from 'next/link';
import Container from '@/components/ui/Container';
import OpenStatus from './OpenStatus';
import {
  Telegram,
  Viber,
  Instagram,
  Facebook,
  TikTok,
  MapPin,
  Phone,
  Mail,
} from '@/components/icons';
import type { SiteSettings } from '@/types/settings';

const iconMap: Record<string, React.FC<{ size: number }>> = {
  social_telegram: Telegram,
  social_tiktok: TikTok,
  social_instagram: Instagram,
  social_viber: Viber,
  social_facebook: Facebook,
};

const socialLabels: Record<string, string> = {
  social_telegram: 'Telegram',
  social_tiktok: 'TikTok',
  social_instagram: 'Instagram',
  social_viber: 'Viber',
  social_facebook: 'Facebook',
};

const SOCIAL_KEYS = [
  'social_telegram',
  'social_tiktok',
  'social_instagram',
  'social_viber',
  'social_facebook',
] as const;

const buyerLinks = [
  { href: '/pages/about', label: 'Про компанію' },
  { href: '/pages/delivery', label: 'Доставка та оплата' },
  { href: '/pages/returns', label: 'Повернення' },
  { href: '/faq', label: 'Часті питання' },
  { href: '/pages/cooperation', label: 'Умови співпраці' },
];

const catalogLinks = [
  { href: '/catalog', label: 'Всі товари' },
  { href: '/catalog?promo=true', label: 'Акції' },
  { href: '/catalog?sort=newest', label: 'Новинки' },
  { href: '/bundles', label: 'Комплекти' },
  { href: '/blog', label: 'Блог' },
];

const DEFAULT_DESCRIPTION =
  'Інтернет-магазин побутової хімії та засобів для дому. Широкий асортимент, вигідні ціни, швидка доставка по Україні.';

function mapsLinkFor(address: string, placeId: string): string {
  if (placeId)
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const linkClass =
  'rounded-sm text-sm text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-footer-bg)]';

const socialIconClass =
  'flex h-9 w-9 items-center justify-center rounded-md text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-footer-bg)]';

export default function Footer({ settings }: { settings: SiteSettings }) {
  const socialLinks = SOCIAL_KEYS.filter((key) => settings[key]).map((key) => ({
    href: settings[key],
    label: socialLabels[key],
    Icon: iconMap[key],
  }));

  const mapsHref = mapsLinkFor(settings.site_address, settings.google_business_place_id);
  const description = settings.company_description || DEFAULT_DESCRIPTION;

  return (
    <footer aria-labelledby="footer-heading" className="bg-[var(--color-footer-bg)] text-white/65">
      <h2 id="footer-heading" className="sr-only">
        Інформація сайту
      </h2>

      <Container className="py-8 lg:py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] lg:gap-12">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] focus-visible:rounded"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-black text-white">
                {settings.site_name.charAt(0)}
              </span>
              <span className="text-[var(--color-primary-light)]">{settings.site_name}</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">{description}</p>

            {socialLinks.length > 0 && (
              <>
                <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-white/55">
                  Ми в соцмережах
                </h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  {socialLinks.map(({ href, label, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className={socialIconClass}
                    >
                      <Icon size={20} />
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Buyers */}
          <nav aria-label="Покупцям">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/55">
              Покупцям
            </h3>
            <ul className="flex flex-col gap-2">
              {buyerLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Catalog */}
          <nav aria-label="Каталог">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/55">
              Каталог
            </h3>
            <ul className="flex flex-col gap-2">
              {catalogLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contacts */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/55">
              Контакти
            </h3>
            <address className="flex flex-col gap-3 not-italic">
              <a
                href={`tel:${settings.site_phone}`}
                className="group inline-flex items-start gap-2 text-base font-semibold text-white transition-colors hover:text-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] focus-visible:rounded"
              >
                <Phone
                  size={16}
                  className="mt-1 text-white/55 transition-colors group-hover:text-[var(--color-primary-light)]"
                />
                <span>{settings.site_phone_display}</span>
              </a>

              <div className="ml-6">
                <OpenStatus />
                <p className="mt-1 text-xs text-white/45">{settings.working_hours}</p>
              </div>

              {settings.site_email && (
                <a
                  href={`mailto:${settings.site_email}`}
                  className="group inline-flex items-start gap-2 text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] focus-visible:rounded"
                >
                  <Mail
                    size={16}
                    className="mt-0.5 text-white/55 transition-colors group-hover:text-white"
                  />
                  <span>{settings.site_email}</span>
                </a>
              )}

              {settings.site_address && (
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-white/55" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm text-white/70">{settings.site_address}</span>
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-[var(--color-primary-light)] transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)]"
                    >
                      На мапі
                    </a>
                  </div>
                </div>
              )}
            </address>
          </div>
        </div>
      </Container>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.08]">
        <Container className="flex flex-col items-center gap-4 py-4 lg:flex-row lg:justify-center">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/55">
            <span>
              &copy; {new Date().getFullYear()} {settings.site_name}
            </span>
            <Link href="/pages/privacy-policy" className="transition-colors hover:text-white">
              Політика конфіденційності
            </Link>
            <Link href="/pages/public-offer" className="transition-colors hover:text-white">
              Публічна оферта
            </Link>
          </div>
        </Container>
      </div>

      {/* Mobile bottom-nav spacer: 60px nav + safe area */}
      <div
        aria-hidden="true"
        className="lg:hidden"
        style={{ height: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
      />
    </footer>
  );
}
