// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

import Breadcrumbs from './Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders breadcrumb items', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Catalog', href: '/catalog' },
      { label: 'Product' },
    ];
    render(<Breadcrumbs items={items} />);
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Product').length).toBeGreaterThan(0);
  });



  it('renders links for non-last items with href', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Catalog', href: '/catalog' },
      { label: 'Product' },
    ];
    render(<Breadcrumbs items={items} />);
    const homeLinks = screen.getAllByText('Home');
    expect(homeLinks.some(el => el.tagName === 'A')).toBe(true);
    const catalogLinks = screen.getAllByText('Catalog');
    expect(catalogLinks.some(el => el.tagName === 'A')).toBe(true);
  });

  it('renders last item as span (not a link)', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Product' },
    ];
    render(<Breadcrumbs items={items} />);
    const productElements = screen.getAllByText('Product');
    // All should be spans (not links)
    productElements.forEach(el => {
      expect(el.tagName).toBe('SPAN');
    });
  });

  it('renders last item as span even if it has href', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Catalog', href: '/catalog' },
    ];
    render(<Breadcrumbs items={items} />);
    // The last item should be rendered as a span regardless of href
    const catalogElements = screen.getAllByText('Catalog');
    // At least one should be a span (the last-item render)
    expect(catalogElements.some(el => el.tagName === 'SPAN')).toBe(true);
  });

  it('renders JSON-LD script', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Product' },
    ];
    const { container } = render(<Breadcrumbs items={items} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const jsonLd = JSON.parse(script!.innerHTML);
    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement).toHaveLength(2);
    expect(jsonLd.itemListElement[0].name).toBe('Home');
    expect(jsonLd.itemListElement[0].position).toBe(1);
    expect(jsonLd.itemListElement[1].name).toBe('Product');
    expect(jsonLd.itemListElement[1].position).toBe(2);
  });

  it('includes item URL in JSON-LD when href is present', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Product' },
    ];
    const { container } = render(<Breadcrumbs items={items} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script!.innerHTML);
    expect(jsonLd.itemListElement[0].item).toContain('/');
    expect(jsonLd.itemListElement[1].item).toBeUndefined();
  });

  it('renders mobile shortened breadcrumbs when more than 3 items', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Category', href: '/category' },
      { label: 'Subcategory', href: '/subcategory' },
      { label: 'Product' },
    ];
    render(<Breadcrumbs items={items} />);
    // The ellipsis should be rendered on mobile
    const ellipsis = screen.getAllByText('…');
    expect(ellipsis.length).toBeGreaterThan(0);
  });


  it('renders both desktop and mobile lists', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Product' },
    ];
    const { container } = render(<Breadcrumbs items={items} />);
    const ols = container.querySelectorAll('ol');
    expect(ols.length).toBe(2); // desktop + mobile
  });

  it('renders item without href as span (non-link)', () => {
    const items = [
      { label: 'Single' },
    ];
    render(<Breadcrumbs items={items} />);
    const elements = screen.getAllByText('Single');
    elements.forEach(el => {
      expect(el.tagName).toBe('SPAN');
    });
  });
});
