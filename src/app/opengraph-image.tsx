import { ImageResponse } from 'next/og';
import { getSettings } from '@/services/settings';

export const alt = 'Інтернет-магазин побутової хімії';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const settings = await getSettings().catch(() => null);
  const siteName = settings?.site_name ?? 'Clean Shop';
  const tagline =
    settings?.default_seo_description ??
    'Гуртово-роздрібний інтернет-магазин побутової хімії. Швидка доставка по Україні.';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '80px',
        background: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
        {siteName}
      </div>
      <div
        style={{
          marginTop: 32,
          fontSize: 36,
          lineHeight: 1.3,
          opacity: 0.92,
          maxWidth: 1000,
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          marginTop: 'auto',
          fontSize: 28,
          opacity: 0.85,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: '#ffc107',
            display: 'inline-block',
          }}
        />
        Україна
      </div>
    </div>,
    { ...size },
  );
}
