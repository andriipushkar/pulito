import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ContactForm from '@/components/common/ContactForm';
import { Phone, Mail, MapPin, Clock } from '@/components/icons';
import { getSettings } from '@/services/settings';
import { geocodeAddress } from '@/lib/geocode';
import ContactMap from '@/components/contacts/ContactMap';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Контакти',
  description: "Зв'яжіться з нами. Адреса, телефон, email та форма зворотного зв'язку.",
  alternates: {
    canonical: `${baseUrl}/contacts`,
    languages: {
      uk: `${baseUrl}/contacts`,
      en: `${baseUrl}/en/contacts`,
      'x-default': `${baseUrl}/contacts`,
    },
  },
  openGraph: {
    title: 'Контакти — Pulito Trade',
    description: "Зв'яжіться з нами. Адреса, телефон, email та форма зворотного зв'язку.",
    url: `${baseUrl}/contacts`,
    siteName: 'Pulito Trade',
    type: 'website',
    images: [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Контакти — Pulito Trade',
    description: "Зв'яжіться з нами. Адреса, телефон, email та форма зворотного зв'язку.",
    images: [`${baseUrl}/opengraph-image`],
  },
};

export default async function ContactsPage() {
  const settings = await getSettings();
  const point = settings.site_address ? await geocodeAddress(settings.site_address) : null;

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: settings.site_name,
    description: settings.company_description,
    '@id': `${baseUrl}/#business`,
    url: baseUrl,
    telephone: settings.site_phone,
    email: settings.site_email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.site_address,
      addressLocality: 'Львів',
      addressRegion: 'Львівська область',
      postalCode: '79036',
      addressCountry: 'UA',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '20:00',
      },
    ],
  };

  return (
    <Container className="py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Breadcrumbs
        items={[{ label: 'Головна', href: '/' }, { label: 'Контакти' }]}
        className="mb-6"
      />

      <h1 className="mb-8 text-3xl font-bold">Контакти</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <Phone size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-semibold">Телефон</h3>
                <a
                  href={`tel:${settings.site_phone}`}
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                >
                  {settings.site_phone_display}
                </a>
              </div>
            </div>
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <Mail size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-semibold">Email</h3>
                <a
                  href={`mailto:${settings.site_email}`}
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                >
                  {settings.site_email}
                </a>
              </div>
            </div>
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <MapPin size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-semibold">Адреса</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {settings.site_address}
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <Clock size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-semibold">Графік роботи</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {settings.working_hours}
                </p>
              </div>
            </div>
          </div>

          {settings.site_address && (
            <div className="space-y-2">
              {point ? (
                <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
                  <ContactMap lat={point.lat} lon={point.lon} label={settings.site_address} />
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                  Не вдалося завантажити карту
                </div>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.site_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
              >
                Відкрити в Google Maps →
              </a>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-xl font-bold">Напишіть нам</h2>
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}
