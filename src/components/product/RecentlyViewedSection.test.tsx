// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockIds = vi.hoisted(() => ({ value: [] as number[] }));
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useRecentlyViewed', () => ({
  useRecentlyViewed: () => ({ ids: mockIds.value }),
}));
vi.mock('./ProductCarousel', () => ({
  default: ({ title, products }: any) => (
    <div data-testid="carousel">
      <span>{title}</span>
      <span data-testid="product-count">{products.length}</span>
    </div>
  ),
}));

import RecentlyViewedSection from './RecentlyViewedSection';

describe('RecentlyViewedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIds.value = [];
    global.fetch = mockFetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no recently viewed ids', () => {
    const { container } = render(<RecentlyViewedSection />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when ids exist but fetch returns no products', async () => {
    mockIds.value = [1, 2, 3];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    });
    const { container } = render(<RecentlyViewedSection />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when fetch returns success: false', async () => {
    mockIds.value = [1, 2];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
    const { container } = render(<RecentlyViewedSection />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders ProductCarousel with products when data is returned', async () => {
    mockIds.value = [1, 2];
    const products = [
      { id: 1, name: 'Product 1' },
      { id: 2, name: 'Product 2' },
    ];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: products }),
    });
    const { findByTestId, findByText } = render(<RecentlyViewedSection />);
    expect(await findByTestId('carousel')).toBeInTheDocument();
    expect(await findByText('Нещодавно переглянуті')).toBeInTheDocument();
    const count = await findByTestId('product-count');
    expect(count.textContent).toBe('2');
  });

  it('fetches with correct URL containing ids', async () => {
    mockIds.value = [5, 10, 15];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [{ id: 5 }] }),
    });
    render(<RecentlyViewedSection />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/products?limit=15&ids=5,10,15');
    });
  });

  it('handles fetch error gracefully', async () => {
    mockIds.value = [1];
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { container } = render(<RecentlyViewedSection />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('does not fetch when ids array is empty', () => {
    mockIds.value = [];
    render(<RecentlyViewedSection />);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
