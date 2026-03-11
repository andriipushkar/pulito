// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAddItem = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/icons', () => ({
  Close: () => <span data-testid="close-icon" />,
  Cart: () => <span data-testid="cart-icon" />,
}));
vi.mock('@/components/ui/Button', () => ({
  default: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('./PriceDisplay', () => ({ default: () => <div data-testid="price-display" /> }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: any[]) => mockApiGet(...args) },
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: mockAddItem }) }));

import QuickView from './QuickView';

describe('QuickView', () => {

const mockProduct = {
  id: 1,
  name: 'Test Product',
  slug: 'test-product',
  code: 'TP001',
  priceRetail: '100.00',
  priceWholesale: '80.00',
  priceRetailOld: '120.00',
  quantity: 10,
  imagePath: '/default.jpg',
  images: [{ pathMedium: '/med.jpg' }],
  badges: [],
  category: null,
  content: null,
};

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ success: false });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders dialog with correct role', () => {
    const { getByRole } = render(<QuickView productId={1} onClose={vi.fn()} />);
    expect(getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<QuickView productId={1} onClose={onClose} />);
    const overlay = container.querySelector('[aria-hidden="true"]');
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<QuickView productId={1} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose on non-Escape key', () => {
    const onClose = vi.fn();
    render(<QuickView productId={1} onClose={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    // onClose should not be called for non-Escape
  });

  it('shows loading spinner initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const { container } = render(<QuickView productId={1} onClose={vi.fn()} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders product info when loaded', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    expect(await findByText('Test Product')).toBeInTheDocument();
    expect(await findByText('Код: TP001')).toBeInTheDocument();
  });

  it('shows in-stock status', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    expect(await findByText('В наявності (10 шт.)')).toBeInTheDocument();
  });

  it('shows out-of-stock status', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { ...mockProduct, quantity: 0 } });
    const { findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    expect(await findByText('Немає в наявності')).toBeInTheDocument();
  });

  it('does not show quantity controls when out of stock', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { ...mockProduct, quantity: 0 } });
    const { findByText, queryByLabelText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    await findByText('Немає в наявності');
    expect(queryByLabelText('Зменшити кількість')).not.toBeInTheDocument();
    expect(queryByLabelText('Збільшити кількість')).not.toBeInTheDocument();
  });

  it('renders product image', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { container } = render(<QuickView productId={1} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('img[src="/med.jpg"]')).toBeInTheDocument();
    });
  });

  it('falls back to imagePath when no image in images array', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: { ...mockProduct, images: [{ pathMedium: null }] },
    });
    const { container } = render(<QuickView productId={1} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('img[src="/default.jpg"]')).toBeInTheDocument();
    });
  });

  it('shows camera emoji when no image', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: { ...mockProduct, images: [{ pathMedium: null }], imagePath: null },
    });
    const { container } = render(<QuickView productId={1} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.textContent).toContain('\uD83D\uDCF7');
    });
  });

  it('calls API with correct productId', () => {
    render(<QuickView productId={42} onClose={vi.fn()} />);
    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/products/42');
  });

  it('shows "Товар не знайдено" when product is null after loading', async () => {
    mockApiGet.mockResolvedValue({ success: false, data: null });
    const { findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    expect(await findByText('Товар не знайдено')).toBeInTheDocument();
  });

  it('increments quantity on + click', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByLabelText, findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    const plusBtn = await findByLabelText('Збільшити кількість');
    fireEvent.click(plusBtn);
    expect(await findByText('2')).toBeInTheDocument();
  });

  it('decrements quantity on - click', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByLabelText, findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    const plusBtn = await findByLabelText('Збільшити кількість');
    fireEvent.click(plusBtn); // now 2
    const minusBtn = await findByLabelText('Зменшити кількість');
    fireEvent.click(minusBtn); // back to 1
    expect(await findByText('1')).toBeInTheDocument();
  });

  it('does not decrement below 1', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByLabelText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    const minusBtn = await findByLabelText('Зменшити кількість');
    fireEvent.click(minusBtn);
    // Still should be 1
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('1');
  });

  it('does not increment above max quantity', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { ...mockProduct, quantity: 2 } });
    const { findByLabelText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    const plusBtn = await findByLabelText('Збільшити кількість');
    fireEvent.click(plusBtn); // 2
    fireEvent.click(plusBtn); // should stay at 2
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('2');
  });

  it('calls addItem and onClose when add to cart is clicked', async () => {
    const onClose = vi.fn();
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByText } = render(<QuickView productId={1} onClose={onClose} />);
    const addBtn = await findByText('В кошик');
    fireEvent.click(addBtn);
    expect(mockAddItem).toHaveBeenCalledWith({
      productId: 1,
      name: 'Test Product',
      slug: 'test-product',
      code: 'TP001',
      priceRetail: 100,
      priceWholesale: 80,
      imagePath: '/med.jpg',
      quantity: 1,
      maxQuantity: 10,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call addItem when product quantity is 0', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { ...mockProduct, quantity: 0 } });
    const { findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    await findByText('Немає в наявності');
    // No add to cart button visible
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const { findByLabelText } = render(<QuickView productId={1} onClose={onClose} />);
    const closeBtn = await findByLabelText('Закрити вікно');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders link to product detail page', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByText } = render(<QuickView productId={1} onClose={vi.fn()} />);
    const link = await findByText('Детальніше про товар →');
    expect(link.closest('a')).toHaveAttribute('href', '/product/test-product');
  });

  it('calls onClose when detail link is clicked', async () => {
    const onClose = vi.fn();
    mockApiGet.mockResolvedValue({ success: true, data: mockProduct });
    const { findByText } = render(<QuickView productId={1} onClose={onClose} />);
    const link = await findByText('Детальніше про товар →');
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it('uses null for priceWholesale when not provided', async () => {
    const onClose = vi.fn();
    mockApiGet.mockResolvedValue({ success: true, data: { ...mockProduct, priceWholesale: null } });
    const { findByText } = render(<QuickView productId={1} onClose={onClose} />);
    const addBtn = await findByText('В кошик');
    fireEvent.click(addBtn);
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ priceWholesale: null })
    );
  });

  it('uses imagePath fallback in addItem when images pathMedium is null', async () => {
    const onClose = vi.fn();
    mockApiGet.mockResolvedValue({
      success: true,
      data: { ...mockProduct, images: [{ pathMedium: null }], imagePath: '/fallback.jpg' },
    });
    const { findByText } = render(<QuickView productId={1} onClose={onClose} />);
    const addBtn = await findByText('В кошик');
    fireEvent.click(addBtn);
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ imagePath: '/fallback.jpg' })
    );
  });

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<QuickView productId={1} onClose={vi.fn()} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});
