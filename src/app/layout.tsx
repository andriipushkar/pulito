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
import { getActiveTheme } from '@/services/theme';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'cyrillic-ext'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title =
    settings.default_seo_title || `${settings.site_name} — Інтернет-магазин побутової хімії`;
  const description =
    settings.default_seo_description ||
    'Гуртово-роздрібний інтернет-магазин побутової хімії. Широкий асортимент, вигідні ціни, швидка доставка по Україні.';
  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: `%s | ${settings.site_name}`,
    },
    description,
    keywords: ['побутова хімія', 'миючі засоби', 'купити', 'гуртом', 'інтернет-магазин', 'Україна'],
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
      siteName: settings.site_name,
      title,
      description,
      url: baseUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: baseUrl,
      languages: {
        uk: baseUrl,
        en: `${baseUrl}/en`,
        'x-default': baseUrl,
      },
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: settings.site_name,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, settings, activeTheme] = await Promise.all([
    getLocale(),
    getMessages(),
    getSettings(),
    getActiveTheme().catch(() => null),
  ]);

  const themeCss = activeTheme
    ? `:root{${Object.entries(activeTheme.cssVariables)
        .map(([k, v]) => `${k}:${v}`)
        .join(';')}}`
    : '';

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

  // Split "м. Львів, вул. Сихівська, 1" → locality "м. Львів", street "вул. Сихівська, 1".
  const [addressLocality, ...streetParts] = (settings.site_address || '').split(',');
  const streetAddress = streetParts.join(',').trim();

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}#organization`,
    name: settings.site_name,
    url: baseUrl,
    logo: `${baseUrl}/images/icon-512.png`,
    image: `${baseUrl}/images/icon-512.png`,
    description: settings.company_description,
    priceRange: '₴₴',
    telephone: settings.site_phone,
    email: settings.site_email,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: settings.site_phone,
      email: settings.site_email,
      contactType: 'customer service',
      availableLanguage: ['Ukrainian', 'Russian'],
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'UA',
      addressLocality: (addressLocality || settings.site_address || '').trim(),
      ...(streetAddress && { streetAddress }),
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
        dayOfWeek: 'Saturday',
        opens: '10:00',
        closes: '15:00',
      },
    ],
    sameAs: [
      settings.social_instagram,
      settings.social_telegram,
      settings.social_tiktok,
      settings.social_facebook,
      settings.social_viber,
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
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${settings.site_name} — Нові товари`}
          href="/feed.xml"
        />
        {themeCss ? (
          <style id="active-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />
        ) : null}
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
            <ThemeProvider>{children}</ThemeProvider>
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
            even when these scripts are blocked by ad blockers.
            IDs are sourced from SiteSetting so the admin form is the single
            source of truth — env fallbacks let CI/preview envs still ship pixels
            before settings are seeded. */}
        {(() => {
          const ga4Id = settings.google_analytics_id?.trim() || process.env.NEXT_PUBLIC_GA4_ID;
          const fbPixelId = settings.facebook_pixel_id?.trim() || process.env.NEXT_PUBLIC_FB_PIXEL_ID;
          return (
            <>
              {ga4Id && (
                <>
                  <Script
                    src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
                    strategy="lazyOnload"
                  />
                  <Script id="ga4-init" strategy="lazyOnload">
                    {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4Id}',{send_page_view:true});`}
                  </Script>
                </>
              )}
              {fbPixelId && (
                <Script id="fb-pixel" strategy="lazyOnload">
                  {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbPixelId}');fbq('track','PageView');`}
                </Script>
              )}
            </>
          );
        })()}
      </body>
    </html>
  );
}
