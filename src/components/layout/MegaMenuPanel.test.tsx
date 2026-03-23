// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: (props: any) => <img {...props} /> }));
vi.mock('@/components/icons', () => ({
  ChevronRight: () => <span data-testid="chevron-right">&gt;</span>,
}));

import MegaMenuPanel from './MegaMenuPanel';
import type { CategoryWithChildren } from '@/types/category';

const makeCategory = (overrides: Partial<CategoryWithChildren> = {}): CategoryWithChildren => ({
  id: 1,
  name: 'Cleaning',
  slug: 'cleaning',
  iconPath: null,
  coverImage: null,
  description: null,
  sortOrder: 0,
  isVisible: true,
  parentId: null,
  _count: { products: 50 },
  children: [],
  ...overrides,
});

const makeChild = (overrides: Partial<CategoryWithChildren> = {}): CategoryWithChildren => ({
  id: 10,
  name: 'Powders',
  slug: 'powders',
  iconPath: null,
  coverImage: null,
  description: null,
  sortOrder: 0,
  isVisible: true,
  parentId: 1,
  _count: { products: 20 },
  children: [],
  ...overrides,
});

describe('MegaMenuPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders category name in the "View all" link', () => {
    const cat = makeCategory();
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);
    expect(container.querySelector('a[href="/catalog?category=cleaning"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Дивитись все');
  });

  it('renders subcategories (level 2)', () => {
    const cat = makeCategory({
      children: [
        makeChild({ id: 10, name: 'Powders', slug: 'powders' }),
        makeChild({ id: 11, name: 'Gels', slug: 'gels' }),
      ],
    });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);
    expect(container.querySelector('a[href="/catalog?category=powders"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/catalog?category=gels"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Powders');
    expect(container.textContent).toContain('Gels');
  });

  it('renders grandchild categories (level 3)', () => {
    const cat = makeCategory({
      children: [
        makeChild({
          id: 10,
          name: 'Powders',
          slug: 'powders',
          children: [
            makeChild({ id: 100, name: 'Auto Powder', slug: 'auto-powder', parentId: 10, _count: { products: 5 } }),
            makeChild({ id: 101, name: 'Hand Powder', slug: 'hand-powder', parentId: 10, _count: { products: 3 } }),
          ],
        }),
      ],
    });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);
    expect(container.querySelector('a[href="/catalog?category=auto-powder"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/catalog?category=hand-powder"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Auto Powder');
    expect(container.textContent).toContain('Hand Powder');

    // Grandchild links have the correct test id
    const grandchildren = container.querySelectorAll('[data-testid="grandchild-link"]');
    expect(grandchildren.length).toBe(2);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    const cat = makeCategory({
      children: [makeChild()],
    });
    render(<MegaMenuPanel category={cat} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows category image when available', () => {
    const cat = makeCategory({
      coverImage: '/images/cleaning.jpg',
      description: 'All cleaning products',
      children: [makeChild()],
    });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);

    const img = container.querySelector('img[src="/images/cleaning.jpg"]');
    expect(img).toBeInTheDocument();
    expect(container.textContent).toContain('All cleaning products');
  });

  it('does not render image section when coverImage is null', () => {
    const cat = makeCategory({ coverImage: null, children: [makeChild()] });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('supports keyboard arrow navigation between links', () => {
    const cat = makeCategory({
      children: [
        makeChild({ id: 10, name: 'A', slug: 'a' }),
        makeChild({ id: 11, name: 'B', slug: 'b' }),
      ],
    });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);

    const links = container.querySelectorAll('a');
    // Focus the first link
    (links[0] as HTMLElement).focus();

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(links[1]);

    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(links[0]);
  });

  it('wraps around on arrow navigation', () => {
    const cat = makeCategory({
      children: [makeChild({ id: 10, name: 'A', slug: 'a' })],
    });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);

    const links = container.querySelectorAll('a');
    const lastLink = links[links.length - 1] as HTMLElement;
    lastLink.focus();

    // ArrowDown from last should wrap to first
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(links[0]);
  });

  it('renders promotional banner when provided', () => {
    const cat = makeCategory({ children: [makeChild()] });
    const { container } = render(
      <MegaMenuPanel
        category={cat}
        onClose={vi.fn()}
        promoBanner={<div data-testid="custom-promo">Sale!</div>}
      />,
    );
    expect(container.querySelector('[data-testid="promo-banner"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Sale!');
  });

  it('does not render promotional banner slot when not provided', () => {
    const cat = makeCategory({ children: [makeChild()] });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);
    expect(container.querySelector('[data-testid="promo-banner"]')).toBeNull();
  });

  it('has role="menu" for accessibility', () => {
    const cat = makeCategory({ children: [makeChild()] });
    const { container } = render(<MegaMenuPanel category={cat} onClose={vi.fn()} />);
    expect(container.querySelector('[role="menu"]')).toBeInTheDocument();
  });
});
