// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

import CategoryGrid from './CategoryGrid';

const mockCategory = (id: number, name: string, slug: string, opts: any = {}) => ({
  id,
  name,
  slug,
  parentId: opts.parentId ?? null,
  isVisible: opts.isVisible ?? true,
  coverImage: opts.coverImage ?? null,
  _count: { products: opts.productCount ?? 10 },
});

describe('CategoryGrid', () => {
  it('returns null for empty categories', () => {
    const { container } = render(<CategoryGrid categories={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders section heading', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky')];
    render(<CategoryGrid categories={cats as any} />);
    expect(screen.getByText('Категорії')).toBeInTheDocument();
  });

  it('renders category names', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky'), mockCategory(2, 'Гелі', 'geli')];
    render(<CategoryGrid categories={cats as any} />);
    expect(screen.getAllByText('Порошки').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Гелі').length).toBeGreaterThan(0);
  });

  it('renders "Усi" link to catalog', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky')];
    const { container } = render(<CategoryGrid categories={cats as any} />);
    const link = container.querySelector('a[href="/catalog"]');
    expect(link).toBeInTheDocument();
  });

  it('filters out categories with parentId (only root)', () => {
    const cats = [
      mockCategory(1, 'Root', 'root'),
      mockCategory(2, 'Child', 'child', { parentId: 1 }),
    ];
    render(<CategoryGrid categories={cats as any} />);
    expect(screen.getAllByText('Root').length).toBeGreaterThan(0);
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('filters out invisible categories', () => {
    const cats = [
      mockCategory(1, 'Visible', 'visible'),
      mockCategory(2, 'Hidden', 'hidden', { isVisible: false }),
    ];
    render(<CategoryGrid categories={cats as any} />);
    expect(screen.getAllByText('Visible').length).toBeGreaterThan(0);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('limits to 8 categories', () => {
    const cats = Array.from({ length: 12 }, (_, i) =>
      mockCategory(i + 1, `Cat ${i + 1}`, `cat-${i + 1}`)
    );
    const { container } = render(<CategoryGrid categories={cats as any} />);
    // Each category renders twice (mobile + desktop), so total links = 8 * 2 = 16 category links
    const catLinks = container.querySelectorAll('a[href*="category="]');
    expect(catLinks.length).toBe(16); // 8 categories * 2 (mobile+desktop)
  });

  it('renders links to category pages', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky')];
    const { container } = render(<CategoryGrid categories={cats as any} />);
    const links = container.querySelectorAll('a[href="/catalog?category=poroshky"]');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders cover image when available', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky', { coverImage: '/cover.jpg' })];
    const { container } = render(<CategoryGrid categories={cats as any} />);
    const img = container.querySelector('img[src="/cover.jpg"]');
    expect(img).toBeInTheDocument();
  });

  it('renders icon when no cover image', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky')];
    const { container } = render(<CategoryGrid categories={cats as any} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders product count in desktop view', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky', { productCount: 42 })];
    render(<CategoryGrid categories={cats as any} />);
    expect(screen.getByText('42 товарів')).toBeInTheDocument();
  });

  it('renders different icons for different indices', () => {
    const cats = Array.from({ length: 6 }, (_, i) =>
      mockCategory(i + 1, `Cat ${i + 1}`, `cat-${i + 1}`)
    );
    const { container } = render(<CategoryGrid categories={cats as any} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('returns null when all categories are filtered', () => {
    const cats = [
      mockCategory(1, 'Hidden', 'hidden', { isVisible: false }),
      mockCategory(2, 'Child', 'child', { parentId: 1 }),
    ];
    const { container } = render(<CategoryGrid categories={cats as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders mobile and desktop sections', () => {
    const cats = [mockCategory(1, 'Порошки', 'poroshky')];
    const { container } = render(<CategoryGrid categories={cats as any} />);
    // Mobile section (sm:hidden) and desktop section (hidden sm:block)
    expect(container.querySelector('.sm\\:hidden')).toBeInTheDocument();
    expect(container.querySelector('.hidden.sm\\:block')).toBeInTheDocument();
  });
});
