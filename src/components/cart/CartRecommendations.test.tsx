// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAddItem = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...args: any[]) => mockApiGet(...args) } }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
vi.mock('@/components/icons', () => ({ Cart: () => <span>cart</span> }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import CartRecommendations from './CartRecommendations';

const makeProduct = (id: number, name: string, hasImage = true) => ({
  id,
  name,
  slug: `product-${id}`,
  code: `CODE-${id}`,
  priceRetail: 100 + id,
  imagePath: hasImage ? `/img/${id}.jpg` : null,
  images: hasImage ? [{ pathThumbnail: `/thumb/${id}.jpg` }] : [],
});

describe('CartRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing with empty cart', () => {
    const { container } = render(<CartRecommendations cartProductIds={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows spinner while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
    const { getByTestId } = render(<CartRecommendations cartProductIds={[1]} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders nothing when API returns no data', async () => {
    mockApiGet.mockResolvedValue({ success: false });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="spinner"]')).not.toBeInTheDocument();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders recommended products from API', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(5, 'Рекомендований 1'), makeProduct(6, 'Рекомендований 2')],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Доповніть замовлення');
      expect(container.textContent).toContain('Рекомендований 1');
      expect(container.textContent).toContain('Рекомендований 2');
    });
  });

  it('deduplicates products across multiple cart items', async () => {
    // Both cart items recommend the same product
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(5, 'Same Product')],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1, 2]} />);
    await waitFor(() => {
      const names = Array.from(container.querySelectorAll('.line-clamp-2'));
      const sameProducts = names.filter(n => n.textContent === 'Same Product');
      expect(sameProducts.length).toBe(1);
    });
  });

  it('excludes products already in cart', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(1, 'Already in cart'), makeProduct(5, 'New product')],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('New product');
      expect(container.textContent).not.toContain('Already in cart');
    });
  });

  it('calls addItem when add to cart button is clicked', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(5, 'Test Product')],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Product');
    });

    const addBtn = container.querySelector('[aria-label="В кошик"]') as HTMLElement;
    fireEvent.click(addBtn);

    expect(mockAddItem).toHaveBeenCalledWith({
      productId: 5,
      name: 'Test Product',
      slug: 'product-5',
      code: 'CODE-5',
      priceRetail: 105,
      priceWholesale: null,
      imagePath: '/thumb/5.jpg',
      quantity: 1,
      maxQuantity: 999,
    });
  });

  it('renders product without image with placeholder', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(5, 'No Image Product', false)],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('No Image Product');
    });
    // Should render the placeholder SVG instead of img
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders product links correctly', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(5, 'Linked Product')],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      const links = container.querySelectorAll('a[href="/product/product-5"]');
      expect(links.length).toBe(2); // image link + name link
    });
  });

  it('displays product price correctly', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(5, 'Priced Product')],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('105.00 ₴');
    });
  });

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="spinner"]')).not.toBeInTheDocument();
    });
    expect(container.innerHTML).toBe('');
  });

  it('limits to first 3 cart items for recommendations', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [] });
    render(<CartRecommendations cartProductIds={[1, 2, 3, 4, 5]} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(3);
    });
  });

  it('limits to 8 recommended products max', async () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(100 + i, `Product ${i}`));
    mockApiGet.mockResolvedValue({ success: true, data: products });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      const items = container.querySelectorAll('[aria-label="В кошик"]');
      expect(items.length).toBeLessThanOrEqual(8);
    });
  });

  it('uses imagePath fallback when images array has no thumbnail', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [{
        id: 5, name: 'Fallback', slug: 'fallback', code: 'F-1',
        priceRetail: 50, imagePath: '/fallback.jpg', images: [{ pathThumbnail: null }],
      }],
    });
    const { container } = render(<CartRecommendations cartProductIds={[1]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Fallback');
    });

    const addBtn = container.querySelector('[aria-label="В кошик"]') as HTMLElement;
    fireEvent.click(addBtn);

    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      imagePath: '/fallback.jpg',
    }));
  });
});
