// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: (props: any) => <img {...props} /> }));
vi.mock('@/components/ui/Container', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/icons', () => ({
  ChevronDown: ({ className }: any) => <span className={className} data-testid="chevron-down">v</span>,
  ChevronRight: () => <span data-testid="chevron-right">&gt;</span>,
}));

import CategoryNav from './CategoryNav';

const makeCategory = (overrides: any = {}) => ({
  id: 1,
  name: 'Parent',
  slug: 'parent',
  iconPath: null,
  coverImage: null,
  description: null,
  sortOrder: 0,
  isVisible: true,
  parentId: null,
  _count: { products: 10 },
  ...overrides,
});

describe('CategoryNav', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    const { container } = render(<CategoryNav categories={[]} />);
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('renders catalog link', () => {
    const { container } = render(<CategoryNav categories={[]} />);
    expect(container.textContent).toContain('Каталог');
  });

  it('renders with shrink prop', () => {
    const { container } = render(<CategoryNav categories={[]} shrink />);
    expect(container.querySelector('[class*="py-1"]')).toBeInTheDocument();
  });

  it('renders without shrink prop (py-2)', () => {
    const { container } = render(<CategoryNav categories={[]} />);
    expect(container.querySelector('[class*="py-2"]')).toBeInTheDocument();
  });

  it('renders Акції link when no promo category exists', () => {
    const categories = [makeCategory({ id: 1, name: 'Cleaning', slug: 'cleaning' })];
    const { container } = render(<CategoryNav categories={categories} />);
    expect(container.textContent).toContain('Акції');
    expect(container.querySelector('a[href="/catalog?promo=true"]')).toBeInTheDocument();
  });

  it('does not render Акції link when a promo category exists', () => {
    const categories = [makeCategory({ id: 1, name: 'Акції', slug: 'акції' })];
    const { container } = render(<CategoryNav categories={categories} />);
    // The static Акції link should not be rendered
    expect(container.querySelector('a[href="/catalog?promo=true"]')).toBeNull();
  });

  it('does not render Акції link for sale slug', () => {
    const categories = [makeCategory({ id: 1, name: 'Sale', slug: 'sale' })];
    const { container } = render(<CategoryNav categories={categories} />);
    expect(container.querySelector('a[href="/catalog?promo=true"]')).toBeNull();
  });

  it('does not render Акції link for promo slug', () => {
    const categories = [makeCategory({ id: 1, name: 'Promo', slug: 'promo' })];
    const { container } = render(<CategoryNav categories={categories} />);
    expect(container.querySelector('a[href="/catalog?promo=true"]')).toBeNull();
  });

  it('renders parent category links', () => {
    const categories = [
      makeCategory({ id: 1, name: 'Порошки', slug: 'poroshky' }),
      makeCategory({ id: 2, name: 'Гелі', slug: 'geli' }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    expect(container.querySelector('a[href="/catalog?category=poroshky"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/catalog?category=geli"]')).toBeInTheDocument();
  });

  it('does not show ChevronDown for categories without children', () => {
    const categories = [makeCategory({ id: 1, name: 'NoChild', slug: 'nochild' })];
    const { container } = render(<CategoryNav categories={categories} />);
    expect(container.querySelector('[data-testid="chevron-down"]')).toBeNull();
  });

  it('shows ChevronDown for categories with children', () => {
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    expect(container.querySelector('[data-testid="chevron-down"]')).toBeInTheDocument();
  });

  it('opens mega-menu on mouse enter for category with children', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child1', slug: 'child1', parentId: 1, _count: { products: 5 } }),
      makeCategory({ id: 3, name: 'Child2', slug: 'child2', parentId: 1, _count: { products: 3 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    // Hover over the parent li
    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    // Mega-menu should be rendered
    expect(container.querySelector('a[href="/catalog?category=child1"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/catalog?category=child2"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Дивитись все');
    expect(container.textContent).toContain('5'); // product count
    rafSpy.mockRestore();
  });

  it('closes mega-menu on mouse leave with delay', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);
    expect(container.querySelector('a[href="/catalog?category=child"]')).toBeInTheDocument();

    fireEvent.mouseLeave(parentLi);

    // After 100ms delay + 200ms fade-out
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(container.querySelector('a[href="/catalog?category=child"]')).toBeNull();
    rafSpy.mockRestore();
  });

  it('cancels close timer when re-hovering', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);
    fireEvent.mouseLeave(parentLi);

    // Re-hover before timer fires
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.mouseEnter(parentLi);

    // Menu should still be open
    act(() => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('a[href="/catalog?category=child"]')).toBeInTheDocument();
    rafSpy.mockRestore();
  });

  it('closes mega-menu on Escape key', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);
    expect(container.querySelector('a[href="/catalog?category=child"]')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    act(() => { vi.advanceTimersByTime(200); });
    expect(container.querySelector('a[href="/catalog?category=child"]')).toBeNull();
    rafSpy.mockRestore();
  });

  it('does not close on Escape when no menu is open', () => {
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    // Press Escape with no open menu - should not crash
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('does not trigger hover on category without children', () => {
    const categories = [makeCategory({ id: 1, name: 'Solo', slug: 'solo' })];
    const { container } = render(<CategoryNav categories={categories} />);
    const li = container.querySelector('li.static')!;
    fireEvent.mouseEnter(li);
    // No mega-menu should appear
    expect(container.textContent).not.toContain('Дивитись все');
  });

  it('renders cover image when available', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent', coverImage: '/cover.jpg', description: 'Cool category' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    // Cover image should be rendered
    const img = container.querySelector('img[src="/cover.jpg"]');
    expect(img).toBeInTheDocument();
    // Description should be rendered
    expect(container.textContent).toContain('Cool category');
    rafSpy.mockRestore();
  });

  it('renders cover image without description', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent', coverImage: '/cover.jpg', description: null }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    const img = container.querySelector('img[src="/cover.jpg"]');
    expect(img).toBeInTheDocument();
    rafSpy.mockRestore();
  });

  it('applies correct grid columns for few children without cover', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    // 4 children, no cover => min(2, 4) = 2 columns
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      ...Array.from({ length: 4 }, (_, i) =>
        makeCategory({ id: 10 + i, name: `Child${i}`, slug: `child${i}`, parentId: 1 })
      ),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('style')).toContain('repeat(2');
    rafSpy.mockRestore();
  });

  it('applies correct grid columns for many children without cover', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    // 5 children, no cover => min(3, 4) = 3 columns
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      ...Array.from({ length: 5 }, (_, i) =>
        makeCategory({ id: 10 + i, name: `Child${i}`, slug: `child${i}`, parentId: 1 })
      ),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('style')).toContain('repeat(3');
    rafSpy.mockRestore();
  });

  it('applies correct grid columns for 9+ children without cover', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    // 9 children, no cover => maxCols=4
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeCategory({ id: 10 + i, name: `Child${i}`, slug: `child${i}`, parentId: 1 })
      ),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('style')).toContain('repeat(4');
    rafSpy.mockRestore();
  });

  it('applies correct grid columns with cover image (maxCols=3)', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    // 9 children, with cover => maxCols=3
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent', coverImage: '/c.jpg' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeCategory({ id: 10 + i, name: `Child${i}`, slug: `child${i}`, parentId: 1 })
      ),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('style')).toContain('repeat(3');
    rafSpy.mockRestore();
  });

  it('applies correct grid columns for few children with cover', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    // 3 children, with cover => min(2, 3) = 2
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent', coverImage: '/c.jpg' }),
      ...Array.from({ length: 3 }, (_, i) =>
        makeCategory({ id: 10 + i, name: `Child${i}`, slug: `child${i}`, parentId: 1 })
      ),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('style')).toContain('repeat(2');
    rafSpy.mockRestore();
  });

  it('keeps menu open when hovering over the mega-menu itself', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    // Hover over mega-menu div
    const megaMenu = container.querySelector('.absolute.inset-x-0')!;
    fireEvent.mouseEnter(megaMenu);

    // Menu should stay open
    expect(container.querySelector('a[href="/catalog?category=child"]')).toBeInTheDocument();

    // Mouse leave mega-menu
    fireEvent.mouseLeave(megaMenu);
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(container.querySelector('a[href="/catalog?category=child"]')).toBeNull();
    rafSpy.mockRestore();
  });

  it('applies active styles when menu is open', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    const categories = [
      makeCategory({ id: 1, name: 'Parent', slug: 'parent' }),
      makeCategory({ id: 2, name: 'Child', slug: 'child', parentId: 1, _count: { products: 5 } }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);

    const parentLi = container.querySelector('li.static')!;
    fireEvent.mouseEnter(parentLi);

    // The parent link should have active styles
    const parentLink = container.querySelector('a[href="/catalog?category=parent"]')!;
    expect(parentLink.className).toContain('bg-white/20');

    // ChevronDown should be rotated
    const chevron = container.querySelector('[data-testid="chevron-down"]')!;
    expect(chevron.className).toContain('rotate-180');
    rafSpy.mockRestore();
  });

  it('does not trigger menu actions on mouse leave for category without children', () => {
    const categories = [
      makeCategory({ id: 1, name: 'Solo', slug: 'solo' }),
    ];
    const { container } = render(<CategoryNav categories={categories} />);
    const parentLi = container.querySelector('li.static')!;
    // mouseEnter and mouseLeave should not crash or open menus
    fireEvent.mouseEnter(parentLi);
    fireEvent.mouseLeave(parentLi);
    // No mega menu should appear
    expect(container.querySelector('.grid')).toBeNull();
  });
});
