import { NextResponse } from 'next/server';

/**
 * Admin-specific PWA manifest. When the owner installs the app from /admin/*,
 * the browser uses this manifest and the resulting standalone window opens
 * straight on /admin instead of the public shop.
 */
export async function GET() {
  return NextResponse.json(
    {
      name: 'Pulito Admin',
      short_name: 'Pulito Admin',
      description: 'Адмін-панель Pulito Trade',
      start_url: '/admin',
      scope: '/admin',
      display: 'standalone',
      orientation: 'portrait-primary',
      lang: 'uk',
      background_color: '#ffffff',
      theme_color: '#0f172a',
      icons: [
        { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Замовлення', short_name: 'Замовлення', url: '/admin/orders' },
        { name: 'Pick & Pack', short_name: 'Pack', url: '/admin/pack' },
        { name: 'Дошка', short_name: 'Board', url: '/admin/orders/board' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
