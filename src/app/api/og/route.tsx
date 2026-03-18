import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || 'Порошок';
  const price = searchParams.get('price') || '';
  const oldPrice = searchParams.get('oldPrice') || '';
  const category = searchParams.get('category') || '';
  const image = searchParams.get('image') || '';

  const hasDiscount = oldPrice && Number(oldPrice) > Number(price);
  const discount = hasDiscount ? Math.round(((Number(oldPrice) - Number(price)) / Number(oldPrice)) * 100) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          background: 'linear-gradient(135deg, #f0f4ff 0%, #ffffff 50%, #f0fdf4 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Product image */}
        {image && (
          <div style={{ width: '400px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <img src={image} width={320} height={320} style={{ objectFit: 'contain', borderRadius: '16px' }} />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 50px 40px 20px' }}>
          {/* Category */}
          {category && (
            <div style={{ fontSize: '20px', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {category}
            </div>
          )}

          {/* Title */}
          <div style={{ fontSize: '42px', fontWeight: 'bold', color: '#111827', lineHeight: 1.2, marginBottom: '24px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {title}
          </div>

          {/* Price */}
          {price && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '52px', fontWeight: 'bold', color: hasDiscount ? '#dc2626' : '#2563eb' }}>
                {Number(price).toFixed(0)} ₴
              </div>
              {hasDiscount && (
                <>
                  <div style={{ fontSize: '32px', color: '#9ca3af', textDecoration: 'line-through' }}>
                    {Number(oldPrice).toFixed(0)} ₴
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', background: '#dc2626', padding: '4px 16px', borderRadius: '20px' }}>
                    -{discount}%
                  </div>
                </>
              )}
            </div>
          )}

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
              П
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
              Порошок
            </div>
            <div style={{ fontSize: '16px', color: '#9ca3af', marginLeft: '8px' }}>
              Інтернет-магазин побутової хімії
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
