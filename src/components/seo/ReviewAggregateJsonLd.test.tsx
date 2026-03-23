// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import ReviewAggregateJsonLd from './ReviewAggregateJsonLd';

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script!.innerHTML);
}

describe('ReviewAggregateJsonLd', () => {
  const defaultProps = {
    productName: 'Super Cleaner',
    productUrl: 'https://poroshok.ua/product/super-cleaner',
    ratingValue: 4.5,
    reviewCount: 42,
  };

  it('renders a JSON-LD script tag', () => {
    const { container } = render(<ReviewAggregateJsonLd {...defaultProps} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
  });

  it('returns null when reviewCount is 0', () => {
    const { container } = render(
      <ReviewAggregateJsonLd {...defaultProps} reviewCount={0} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('outputs Product schema type', () => {
    const { container } = render(<ReviewAggregateJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('Product');
  });

  it('includes product name and URL', () => {
    const { container } = render(<ReviewAggregateJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data.name).toBe('Super Cleaner');
    expect(data.url).toBe('https://poroshok.ua/product/super-cleaner');
  });

  it('includes aggregateRating with correct values', () => {
    const { container } = render(<ReviewAggregateJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data.aggregateRating['@type']).toBe('AggregateRating');
    expect(data.aggregateRating.ratingValue).toBe('4.5');
    expect(data.aggregateRating.bestRating).toBe('5');
    expect(data.aggregateRating.worstRating).toBe('1');
    expect(data.aggregateRating.reviewCount).toBe(42);
  });
});
