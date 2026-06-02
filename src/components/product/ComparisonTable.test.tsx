// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const mockRemove = vi.fn();
const mockClear = vi.fn();
const mockAddItem = vi.fn();
const mockApiGet = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/hooks/useComparison', () => ({
  useComparison: () => ({
    ids: [1, 2],
    remove: mockRemove,
    clear: mockClear,
    count: 2,
    has: () => false,
    toggle: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: any[]) => mockApiGet(...args) },
}));
vi.mock('@/lib/wholesale-price', () => ({ resolveWholesalePrice: () => null }));
vi.mock('@/components/icons', () => ({
  Cart: () => <span data-testid="cart-icon" />,
  Trash: () => <span data-testid="trash-icon" />,
  Compare: () => <span data-testid="compare-icon" />,
}));
vi.mock('./PriceDisplay', () => ({
  default: () => <div data-testid="price-display" />,
}));

import ComparisonTable from './ComparisonTable';

const makeProduct = (id: number, overrides: any = {}) => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  code: `CODE-${id}`,
  priceRetail: '100.00',
  priceRetailOld: null,
  priceWholesale: null,
  priceWholesale2: null,
  priceWholesale3: null,
  quantity: 10,
  imagePath: `/img/product-${id}.jpg`,
  images: [{ pathMedium: `/img/product-${id}-med.jpg`, pathThumbnail: null }],
  category: { name: 'Category A', slug: 'cat-a' },
  content: { shortDescription: `Description for product ${id}` },
  ...overrides,
});

describe('ComparisonTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ComparisonTable />);
    expect(container.querySelector('[class*="animate-spin"]')).toBeInTheDocument();
  });

  it('renders product names after loading', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(1), makeProduct(2)],
    });
    render(<ComparisonTable />);
    await waitFor(() => {
      expect(screen.getAllByText('Product 1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Product 2').length).toBeGreaterThan(0);
    });
  });

  it('renders item count text', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(1), makeProduct(2)],
    });
    render(<ComparisonTable />);
    await waitFor(() => {
      expect(screen.getByText('2 товари для порівняння')).toBeInTheDocument();
    });
  });

  it('renders "Очистити все" button', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(1), makeProduct(2)],
    });
    render(<ComparisonTable />);
    await waitFor(() => {
      expect(screen.getByText('Очистити все')).toBeInTheDocument();
    });
  });

  it('calls clear when "Очистити все" is clicked', async () => {
    // Clear is now gated behind a confirm() dialog; approve it in the test.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(1), makeProduct(2)],
    });
    render(<ComparisonTable />);
    await waitFor(() => screen.getByText('Очистити все'));
    fireEvent.click(screen.getByText('Очистити все'));
    expect(mockClear).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('renders product codes', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(1), makeProduct(2)],
    });
    render(<ComparisonTable />);
    await waitFor(() => {
      expect(screen.getByText('CODE-1')).toBeInTheDocument();
      expect(screen.getByText('CODE-2')).toBeInTheDocument();
    });
  });

  it('renders "В кошик" buttons', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [makeProduct(1)],
    });
    render(<ComparisonTable />);
    await waitFor(() => {
      expect(screen.getAllByText('В кошик').length).toBeGreaterThan(0);
    });
  });
});
