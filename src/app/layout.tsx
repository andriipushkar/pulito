import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import AuthProvider from '@/providers/AuthProvider';
import ThemeProvider from '@/providers/ThemeProvider';
import ServiceWorkerRegistration from '@/components/common/ServiceWorkerRegistration';
import InstallPrompt from '@/components/common/InstallPrompt';
import CookieBanner from '@/components/ui/CookieBanner';
import WebVitalsReporter from '@/components/common/WebVitalsReporter';
import Toaster from '@/components/common/Toaster';
import { getSettings } from '@/services/settings';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'cyrillic-ext'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

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
  const [locale, messages, settings] = await Promise.all([
    getLocale(),
    getMessages(),
    getSettings(),
  ]);

  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.site_name,
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/catalog?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.site_name,
    url: baseUrl,
    logo: `${baseUrl}/images/icon-512.png`,
    description: settings.company_description,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: settings.site_phone,
      email: settings.site_email,
      contactType: 'customer service',
      availableLanguage: 'Ukrainian',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'UA',
      addressLocality: settings.site_address,
    },
    sameAs: [
      settings.social_instagram,
      settings.social_telegram,
      settings.social_facebook,
    ].filter(Boolean),
  };

  return (
    <html lang={locale} className={plusJakarta.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="apple-touch-icon" href="/images/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="alternate" type="application/rss+xml" title={`${settings.site_name} — Нові товари`} href="/feed.xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
        <WebVitalsReporter />
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <Toaster />
        <CookieBanner />
        {/* Analytics scripts loaded after page becomes interactive (lazyOnload).
            This prevents blocking LCP/FID and keeps PageSpeed score high.
            Server-side tracking via CAPI/Measurement Protocol captures conversions
            even when these scripts are blocked by ad blockers. */}
        {process.env.NEXT_PUBLIC_GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
              strategy="lazyOnload"
            />
            <Script id="ga4-init" strategy="lazyOnload">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA4_ID}',{send_page_view:true});`}
            </Script>
          </>
        )}
        {process.env.NEXT_PUBLIC_FB_PIXEL_ID && (
          <Script id="fb-pixel" strategy="lazyOnload">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');fbq('track','PageView');`}
          </Script>
        )}
      </body>
    </html>
  );
}
