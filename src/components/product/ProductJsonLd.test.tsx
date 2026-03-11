// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ProductJsonLd from './ProductJsonLd';

const makeProduct = (overrides: any = {}): any => ({
  id: 1,
  name: 'Test Product',
  slug: 'test-product',
  code: 'TP001',
  priceRetail: '100.00',
  priceRetailOld: null,
  priceWholesale: null,
  quantity: 10,
  images: [],
  imagePath: '/test.jpg',
  badges: [],
  category: { id: 1, name: 'Cat', slug: 'cat' },
  content: { shortDescription: 'Short desc' },
  promoEndDate: null,
  ...overrides,
});

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.innerHTML) : null;
}

describe('ProductJsonLd', () => {
  it('renders script tag with ld+json', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Product');
  });

  it('includes product name and SKU', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.name).toBe('Test Product');
    expect(data.sku).toBe('TP001');
    expect(data.mpn).toBe('TP001');
  });

  it('includes product URL', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.url).toContain('/product/test-product');
  });

  it('includes description when shortDescription provided', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.description).toBe('Short desc');
  });

  it('omits description when no shortDescription', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({ content: null })} />);
    const data = getJsonLd(container);
    expect(data.description).toBeUndefined();
  });

  it('includes category name', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.category).toBe('Cat');
  });

  it('omits category when null', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({ category: null })} />);
    const data = getJsonLd(container);
    expect(data.category).toBeUndefined();
  });

  it('uses images array when pathFull available', () => {
    const images = [
      { pathFull: '/full1.jpg', pathMedium: null, pathThumbnail: null, pathBlur: null, isMain: true, id: 1 },
      { pathFull: '/full2.jpg', pathMedium: null, pathThumbnail: null, pathBlur: null, isMain: false, id: 2 },
    ];
    const { container } = render(<ProductJsonLd product={makeProduct({ images })} />);
    const data = getJsonLd(container);
    expect(data.image).toEqual(['/full1.jpg', '/full2.jpg']);
  });

  it('uses imagePath as fallback when no images have pathFull', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({ images: [], imagePath: '/fallback.jpg' })} />);
    const data = getJsonLd(container);
    expect(data.image).toBe('/fallback.jpg');
  });

  it('omits image when no images and no imagePath', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({ images: [], imagePath: null })} />);
    const data = getJsonLd(container);
    expect(data.image).toBeUndefined();
  });

  it('includes offer data', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.offers['@type']).toBe('Offer');
    expect(data.offers.price).toBe('100.00');
    expect(data.offers.priceCurrency).toBe('UAH');
    expect(data.offers.itemCondition).toBe('https://schema.org/NewCondition');
  });

  it('shows InStock when quantity > 0', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({ quantity: 5 })} />);
    const data = getJsonLd(container);
    expect(data.offers.availability).toBe('https://schema.org/InStock');
  });

  it('shows OutOfStock when quantity is 0', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({ quantity: 0 })} />);
    const data = getJsonLd(container);
    expect(data.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('includes seller info', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.offers.seller['@type']).toBe('Organization');
    expect(data.offers.seller.name).toBe('Порошок');
  });

  it('includes priceValidUntil when old price > retail and promoEndDate set', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({
      priceRetail: '80.00',
      priceRetailOld: '100.00',
      promoEndDate: '2024-12-31T00:00:00Z',
    })} />);
    const data = getJsonLd(container);
    expect(data.offers.priceValidUntil).toBe('2024-12-31');
  });

  it('omits priceValidUntil when no old price', () => {
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.offers.priceValidUntil).toBeUndefined();
  });

  it('omits priceValidUntil when old price <= retail', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({
      priceRetail: '100.00',
      priceRetailOld: '80.00',
    })} />);
    const data = getJsonLd(container);
    expect(data.offers.priceValidUntil).toBeUndefined();
  });

  it('filters out images without pathFull', () => {
    const images = [
      { pathFull: '/full1.jpg', pathMedium: null, pathThumbnail: null, pathBlur: null, isMain: true, id: 1 },
      { pathFull: null, pathMedium: '/med.jpg', pathThumbnail: null, pathBlur: null, isMain: false, id: 2 },
    ];
    const { container } = render(<ProductJsonLd product={makeProduct({ images })} />);
    const data = getJsonLd(container);
    expect(data.image).toEqual(['/full1.jpg']);
  });

  it('includes content shortDescription omitted when null', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({ content: { shortDescription: null } })} />);
    const data = getJsonLd(container);
    expect(data.description).toBeUndefined();
  });

  it('includes priceValidUntil as undefined when promoEndDate is null', () => {
    const { container } = render(<ProductJsonLd product={makeProduct({
      priceRetail: '80.00',
      priceRetailOld: '100.00',
      promoEndDate: null,
    })} />);
    const data = getJsonLd(container);
    // priceValidUntil should be undefined since no promoEndDate
    expect(data.offers.priceValidUntil).toBeUndefined();
  });

  it('uses APP_URL fallback when NEXT_PUBLIC_APP_URL is not set', () => {
    const origPublic = process.env.NEXT_PUBLIC_APP_URL;
    const origApp = process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.APP_URL = 'https://app.example.com';
    const { container } = render(<ProductJsonLd product={makeProduct()} />);
    const data = getJsonLd(container);
    expect(data.url).toContain('/product/test-product');
    process.env.NEXT_PUBLIC_APP_URL = origPublic;
    process.env.APP_URL = origApp;
  });
});
