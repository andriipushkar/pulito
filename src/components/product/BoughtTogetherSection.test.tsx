// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAddItem = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...args: any[]) => mockApiGet(...args) } }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
vi.mock('@/components/icons', () => ({ Cart: () => <span>cart</span> }));

import BoughtTogetherSection from './BoughtTogetherSection';

const makeProduct = (id: number, hasImage = true) => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  code: `CODE${id}`,
  priceRetail: 100 + id,
  imagePath: hasImage ? `/img-${id}.jpg` : null,
  images: hasImage ? [{ pathThumbnail: `/thumb-${id}.jpg` }] : [],
});

describe('BoughtTogetherSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ success: false });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing initially when API returns no products', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [] });
    const { container } = render(<BoughtTogetherSection productId={1} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/products/1/recommendations');
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when API fails', async () => {
    mockApiGet.mockRejectedValue(new Error('fail'));
    const { container } = render(<BoughtTogetherSection productId={1} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when success is false', async () => {
    mockApiGet.mockResolvedValue({ success: false, data: null });
    const { container } = render(<BoughtTogetherSection productId={1} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders products when API returns data', async () => {
    const products = [makeProduct(1), makeProduct(2)];
    mockApiGet.mockResolvedValue({ success: true, data: products });
    const { findByText } = render(<BoughtTogetherSection productId={1} />);
    expect(await findByText('З цим товаром купують')).toBeInTheDocument();
    expect(await findByText('Product 1')).toBeInTheDocument();
    expect(await findByText('Product 2')).toBeInTheDocument();
  });

  it('limits products to 6', async () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(i + 1));
    mockApiGet.mockResolvedValue({ success: true, data: products });
    const { findAllByText } = render(<BoughtTogetherSection productId={1} />);
    const prices = await findAllByText(/₴/);
    // 6 products shown
    expect(prices.length).toBe(6);
  });

  it('renders product images from thumbnail', async () => {
    const products = [makeProduct(1)];
    mockApiGet.mockResolvedValue({ success: true, data: products });
    const { container } = render(<BoughtTogetherSection productId={1} />);
    await waitFor(() => {
      expect(container.querySelector('img[src="/thumb-1.jpg"]')).toBeInTheDocument();
    });
  });

  it('falls back to imagePath when no thumbnail', async () => {
    const product = {
      ...makeProduct(1),
      images: [{ pathThumbnail: null }],
      imagePath: '/fallback.jpg',
    };
    mockApiGet.mockResolvedValue({ success: true, data: [product] });
    const { container } = render(<BoughtTogetherSection productId={1} />);
    await waitFor(() => {
      expect(container.querySelector('img[src="/fallback.jpg"]')).toBeInTheDocument();
    });
  });

  it('renders placeholder when no image at all', async () => {
    const product = makeProduct(1, false);
    mockApiGet.mockResolvedValue({ success: true, data: [product] });
    const { container } = render(<BoughtTogetherSection productId={1} />);
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('calls addItem when cart button is clicked', async () => {
    const products = [makeProduct(1)];
    mockApiGet.mockResolvedValue({ success: true, data: products });
    const { findByLabelText } = render(<BoughtTogetherSection productId={1} />);
    const btn = await findByLabelText('В кошик');
    fireEvent.click(btn);
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 1,
        name: 'Product 1',
        slug: 'product-1',
        code: 'CODE1',
        priceRetail: 101,
        priceWholesale: null,
        imagePath: '/thumb-1.jpg',
        quantity: 1,
        maxQuantity: 999,
      })
    );
  });

  it('renders price correctly', async () => {
    const products = [makeProduct(1)];
    mockApiGet.mockResolvedValue({ success: true, data: products });
    const { findByText } = render(<BoughtTogetherSection productId={1} />);
    expect(await findByText('101 ₴')).toBeInTheDocument();
  });

  it('renders links to product pages', async () => {
    const products = [makeProduct(1)];
    mockApiGet.mockResolvedValue({ success: true, data: products });
    const { container } = render(<BoughtTogetherSection productId={1} />);
    await waitFor(() => {
      const links = container.querySelectorAll('a[href="/product/product-1"]');
      expect(links.length).toBeGreaterThan(0);
    });
  });

  it('uses imagePath as fallback in handleAdd when images[0].pathThumbnail is null', async () => {
    const product = {
      id: 5,
      name: 'No Thumb',
      slug: 'no-thumb',
      code: 'NT',
      priceRetail: '200',
      imagePath: '/fallback-img.jpg',
      images: [{ pathThumbnail: null }],
    };
    mockApiGet.mockResolvedValue({ success: true, data: [product] });
    const { findByLabelText } = render(<BoughtTogetherSection productId={1} />);
    const btn = await findByLabelText('В кошик');
    fireEvent.click(btn);
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        imagePath: '/fallback-img.jpg',
      })
    );
  });
});
