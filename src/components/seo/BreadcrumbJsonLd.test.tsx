// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import BreadcrumbJsonLd from './BreadcrumbJsonLd';

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script!.innerHTML);
}

describe('BreadcrumbJsonLd', () => {
  const items = [
    { name: 'Home', url: 'https://poroshok.ua/' },
    { name: 'Catalog', url: 'https://poroshok.ua/catalog' },
    { name: 'Product', url: 'https://poroshok.ua/product/test' },
  ];

  it('renders a script tag with application/ld+json type', () => {
    const { container } = render(<BreadcrumbJsonLd items={items} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
  });

  it('outputs BreadcrumbList schema type', () => {
    const { container } = render(<BreadcrumbJsonLd items={items} />);
    const data = getJsonLd(container);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('BreadcrumbList');
  });

  it('creates ListItem entries with correct positions', () => {
    const { container } = render(<BreadcrumbJsonLd items={items} />);
    const data = getJsonLd(container);
    expect(data.itemListElement).toHaveLength(3);
    expect(data.itemListElement[0].position).toBe(1);
    expect(data.itemListElement[1].position).toBe(2);
    expect(data.itemListElement[2].position).toBe(3);
  });

  it('includes name and item URL for each entry', () => {
    const { container } = render(<BreadcrumbJsonLd items={items} />);
    const data = getJsonLd(container);
    expect(data.itemListElement[0].name).toBe('Home');
    expect(data.itemListElement[0].item).toBe('https://poroshok.ua/');
    expect(data.itemListElement[2].name).toBe('Product');
  });

  it('handles single-item breadcrumb', () => {
    const { container } = render(<BreadcrumbJsonLd items={[{ name: 'Home', url: '/' }]} />);
    const data = getJsonLd(container);
    expect(data.itemListElement).toHaveLength(1);
  });
});
