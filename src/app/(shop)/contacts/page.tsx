import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ContactForm from '@/components/common/ContactForm';
import { Phone, Mail, MapPin, Clock } from '@/components/icons';
import { getSettings } from '@/services/settings';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Контакти',
  description: 'Зв\'яжіться з нами. Адреса, телефон, email та форма зворотного зв\'язку.',
  alternates: {
    canonical: `${baseUrl}/contacts`,
    languages: {
      'uk': `${baseUrl}/contacts`,
      'en': `${baseUrl}/en/contacts`,
      'x-default': `${baseUrl}/contacts`,
    },
  },
};

export default async function ContactsPage() {
  const settings = await getSettings();

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
      addressLocality: 'Київ',
      addressCountry: 'UA',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        opens: '10:00',
        closes: '15:00',
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
        items={[
          { label: 'Головна', href: '/' },
          { label: 'Контакти' },
        ]}
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
                <a href={`tel:${settings.site_phone}`} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
                  {settings.site_phone_display}
                </a>
              </div>
            </div>
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <Mail size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-semibold">Email</h3>
                <a href={`mailto:${settings.site_email}`} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
                  {settings.site_email}
                </a>
              </div>
            </div>
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <MapPin size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-semibold">Адреса</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{settings.site_address}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <Clock size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <h3 className="text-sm font-semibold">Графік роботи</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{settings.working_hours}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2540.654291663024!2d30.52140851548823!3d50.44967337947394!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x40d4ce50f8b086e3%3A0xb7dc4c89d7bfa07e!2z0LLRg9C7LiDQpdGA0LXRidCw0YLQuNC6LCAxLCDQmtC40ZfQsiwgMDIwMDA!5e0!3m2!1suk!2sua!4v1&output=embed"
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Наше розташування на карті"
            />
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-bold">Напишіть нам</h2>
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}
