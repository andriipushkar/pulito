// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockScrollPrev = vi.hoisted(() => vi.fn());
const mockScrollNext = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), { scrollPrev: mockScrollPrev, scrollNext: mockScrollNext, canScrollPrev: () => true, canScrollNext: () => true, on: vi.fn(), selectedScrollSnap: () => 0, scrollSnapList: () => [0] }],
}));
vi.mock('./ProductCard', () => ({ default: ({ product }: any) => <div data-testid="product-card">{product.name}</div> }));
vi.mock('@/components/icons', () => ({
  ChevronLeft: () => <span>&lt;</span>,
  ChevronRight: () => <span>&gt;</span>,
}));

import ProductCarousel from './ProductCarousel';

const makeProduct = (id: number) => ({
  id, code: `P${id}`, name: `Product ${id}`, slug: `product-${id}`,
  priceRetail: 100, priceWholesale: null, priceRetailOld: null, priceWholesaleOld: null,
  quantity: 10, isPromo: false, isActive: true, imagePath: null, viewsCount: 0, ordersCount: 0,
  createdAt: '2024-01-01', category: null, badges: [], images: [], content: null,
}) as any;

describe('ProductCarousel', () => {
  afterEach(() => { cleanup(); });

  it('renders nothing when no products', () => {
    const { container } = render(<ProductCarousel title="Test" products={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders title and products', () => {
    const products = [makeProduct(1), makeProduct(2)];
    const { container } = render(<ProductCarousel title="Test Title" products={products} />);
    expect(container.textContent).toContain('Test Title');
  });

  it('renders viewAll link when provided', () => {
    const products = [makeProduct(1)];
    const { container } = render(<ProductCarousel title="Test" products={products} viewAllHref="/catalog" />);
    expect(container.textContent).toContain('Дивитись все');
  });

  it('calls scrollPrev when prev button is clicked', () => {
    const products = [makeProduct(1), makeProduct(2)];
    const { getAllByLabelText } = render(<ProductCarousel title="Test" products={products} />);
    fireEvent.click(getAllByLabelText('Попередній')[0]);
    expect(mockScrollPrev).toHaveBeenCalled();
  });

  it('calls scrollNext when next button is clicked', () => {
    const products = [makeProduct(1), makeProduct(2)];
    const { getAllByLabelText } = render(<ProductCarousel title="Test" products={products} />);
    fireEvent.click(getAllByLabelText('Наступний')[0]);
    expect(mockScrollNext).toHaveBeenCalled();
  });

  it('does not render viewAll link when viewAllHref is not provided', () => {
    const products = [makeProduct(1)];
    const { container } = render(<ProductCarousel title="Test" products={products} />);
    expect(container.textContent).not.toContain('Дивитись все');
  });

  it('renders product cards for each product', () => {
    const products = [makeProduct(1), makeProduct(2), makeProduct(3)];
    const { getAllByTestId } = render(<ProductCarousel title="Test" products={products} />);
    expect(getAllByTestId('product-card').length).toBe(3);
  });
});
