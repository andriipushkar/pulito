import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Порошок — Побутова хімія',
    short_name: 'Порошок',
    description: 'Інтернет-магазин побутової хімії — роздріб та опт',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    lang: 'uk',
    dir: 'ltr',
    categories: ['shopping'],
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      {
        src: '/images/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
      },
      {
        src: '/images/screenshot-narrow.png',
        sizes: '640x1136',
        type: 'image/png',
        form_factor: 'narrow',
      },
    ],
  };
}
