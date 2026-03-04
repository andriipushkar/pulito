import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import ThemeProvider from '@/providers/ThemeProvider';
import ServiceWorkerRegistration from '@/components/common/ServiceWorkerRegistration';
import CookieBanner from '@/components/ui/CookieBanner';
import WebVitalsReporter from '@/components/common/WebVitalsReporter';
import Toaster from '@/components/common/Toaster';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Порошок',
  url: baseUrl,
  logo: `${baseUrl}/images/icon-512.png`,
  description:
    'Оптово-роздрібний інтернет-магазин побутової хімії. Широкий асортимент, вигідні ціни, швидка доставка по Україні.',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: process.env.CONTACT_PHONE || '+380XXXXXXXXX',
    email: process.env.CONTACT_EMAIL || 'info@poroshok.ua',
    contactType: 'customer service',
    availableLanguage: 'Ukrainian',
  },
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'UA',
    addressLocality: process.env.COMPANY_CITY || 'Україна',
  },
  sameAs: [
    process.env.INSTAGRAM_PROFILE_URL,
    process.env.TELEGRAM_CHANNEL_URL,
  ].filter(Boolean),
};

export const metadata: Metadata = {
  title: {
    default: 'Порошок — Інтернет-магазин побутової хімії',
    template: '%s | Порошок',
  },
  description:
    'Оптово-роздрібний інтернет-магазин побутової хімії. Широкий асортимент, вигідні ціни, швидка доставка по Україні.',
  keywords: ['побутова хімія', 'миючі засоби', 'купити', 'оптом', 'інтернет-магазин', 'Україна'],
  robots: {
    index: true,
    follow: true,
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }),
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName: 'Порошок',
  },
  alternates: {
    canonical: baseUrl,
    languages: {
      'uk': baseUrl,
      'en': `${baseUrl}/en`,
      'x-default': baseUrl,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Порошок',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/images/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="alternate" type="application/rss+xml" title="Порошок — Нові товари" href="/feed.xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
        <WebVitalsReporter />
        <ServiceWorkerRegistration />
        <Toaster />
        <CookieBanner />
      </body>
    </html>
  );
}
