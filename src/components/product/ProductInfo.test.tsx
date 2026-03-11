// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAddItem = vi.fn();

vi.mock('@/components/ui/Badge', () => ({ default: ({ children, color }: any) => <span data-testid="badge" data-color={color}>{children}</span> }));
vi.mock('./PriceDisplay', () => ({ default: (props: any) => <div data-testid="price-display" data-size={props.size} /> }));
vi.mock('./QuantitySelector', () => ({
  default: ({ value, onChange, max }: any) => (
    <div data-testid="qty-selector">
      <span data-testid="qty-value">{value}</span>
      <button data-testid="qty-inc" onClick={() => onChange(Math.min(value + 1, max))}>+</button>
      <button data-testid="qty-dec" onClick={() => onChange(Math.max(value - 1, 1))}>-</button>
    </div>
  ),
}));
vi.mock('./ShareButtons', () => ({ default: (props: any) => <div data-testid="share-buttons" data-url={props.url} /> }));
vi.mock('@/components/icons', () => ({
  Heart: () => <span data-testid="heart-icon" />,
  Cart: () => <span data-testid="cart-icon" />,
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: mockAddItem }) }));

import ProductInfo from './ProductInfo';

const makeProduct = (overrides: any = {}) => ({
  id: 1,
  name: 'Test Product',
  slug: 'test-product',
  code: 'TP001',
  priceRetail: '100.00',
  priceWholesale: null,
  priceRetailOld: null,
  quantity: 10,
  imagePath: '/img.jpg',
  images: [{ pathMedium: '/med.jpg' }],
  badges: [],
  ...overrides,
});

describe('ProductInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders product name as h1', () => {
    const { getByRole } = render(<ProductInfo product={makeProduct()} />);
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('Test Product');
  });

  it('renders badges', () => {
    const badges = [
      { id: 1, badgeType: 'NEW', customText: 'Новинка', customColor: '#ff0000' },
      { id: 2, badgeType: 'SALE', customText: null, customColor: null },
    ];
    const { getAllByTestId, getByText } = render(<ProductInfo product={makeProduct({ badges })} />);
    expect(getAllByTestId('badge').length).toBe(2);
    expect(getByText('Новинка')).toBeInTheDocument();
    expect(getByText('SALE')).toBeInTheDocument();
  });

  it('shows in-stock status with quantity', () => {
    const { getByText } = render(<ProductInfo product={makeProduct({ quantity: 5 })} />);
    expect(getByText('В наявності (5 шт.)')).toBeInTheDocument();
  });

  it('shows out-of-stock status', () => {
    const { getByText } = render(<ProductInfo product={makeProduct({ quantity: 0 })} />);
    expect(getByText('Немає в наявності')).toBeInTheDocument();
  });

  it('shows SVG checkmark when in stock', () => {
    const { container } = render(<ProductInfo product={makeProduct({ quantity: 5 })} />);
    const svg = container.querySelector('svg path[d*="4.5 12.75"]');
    expect(svg).toBeInTheDocument();
  });

  it('does not show SVG checkmark when out of stock', () => {
    const { container } = render(<ProductInfo product={makeProduct({ quantity: 0 })} />);
    const svg = container.querySelector('svg path[d*="4.5 12.75"]');
    expect(svg).not.toBeInTheDocument();
  });

  it('has data-add-to-cart attribute on cart button', () => {
    const { container } = render(<ProductInfo product={makeProduct()} />);
    expect(container.querySelector('[data-add-to-cart]')).toBeInTheDocument();
  });

  it('does not show cart button when out of stock', () => {
    const { container } = render(<ProductInfo product={makeProduct({ quantity: 0 })} />);
    expect(container.querySelector('[data-add-to-cart]')).not.toBeInTheDocument();
  });

  it('hides buy section when out of stock', () => {
    const { queryByTestId } = render(<ProductInfo product={makeProduct({ quantity: 0 })} />);
    expect(queryByTestId('qty-selector')).not.toBeInTheDocument();
  });

  it('shows buy section when in stock', () => {
    const { getByTestId } = render(<ProductInfo product={makeProduct({ quantity: 5 })} />);
    expect(getByTestId('qty-selector')).toBeInTheDocument();
  });

  it('calls addItem with correct quantity', () => {
    const { container, getByTestId } = render(<ProductInfo product={makeProduct()} />);
    fireEvent.click(getByTestId('qty-inc'));
    const cartBtn = container.querySelector('[data-add-to-cart]')!;
    fireEvent.click(cartBtn);
    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      productId: 1,
      quantity: 2,
    }));
  });

  it('renders product code', () => {
    const { getByText } = render(<ProductInfo product={makeProduct()} />);
    expect(getByText('Код: TP001')).toBeInTheDocument();
  });

  it('renders PriceDisplay with lg size', () => {
    const { getAllByTestId } = render(<ProductInfo product={makeProduct()} />);
    const priceDisplays = getAllByTestId('price-display');
    expect(priceDisplays.some(el => el.getAttribute('data-size') === 'lg')).toBe(true);
  });

  it('renders share buttons', () => {
    const { getAllByTestId } = render(<ProductInfo product={makeProduct()} />);
    const shareButtons = getAllByTestId('share-buttons');
    expect(shareButtons.some(el => el.getAttribute('data-url') === '/product/test-product')).toBe(true);
  });

  it('renders wishlist button', () => {
    const { getAllByLabelText } = render(<ProductInfo product={makeProduct()} />);
    expect(getAllByLabelText('Додати в обране').length).toBeGreaterThan(0);
  });

  it('passes wholesale price to addItem when available', () => {
    const product = makeProduct({ priceWholesale: '80.00' });
    const { container } = render(<ProductInfo product={product} />);
    const cartBtn = container.querySelector('[data-add-to-cart]')!;
    fireEvent.click(cartBtn);
    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      priceWholesale: 80,
    }));
  });

  it('passes null for wholesale price when not available', () => {
    const product = makeProduct({ priceWholesale: null });
    const { container } = render(<ProductInfo product={product} />);
    const cartBtn = container.querySelector('[data-add-to-cart]')!;
    fireEvent.click(cartBtn);
    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      priceWholesale: null,
    }));
  });

  it('uses images pathMedium over imagePath for addItem', () => {
    const product = makeProduct({ images: [{ pathMedium: '/med-img.jpg' }], imagePath: '/default.jpg' });
    const { container } = render(<ProductInfo product={product} />);
    const cartBtn = container.querySelector('[data-add-to-cart]')!;
    fireEvent.click(cartBtn);
    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      imagePath: '/med-img.jpg',
    }));
  });

  it('falls back to imagePath when images array is empty', () => {
    const product = makeProduct({ images: [], imagePath: '/fallback.jpg' });
    const { container } = render(<ProductInfo product={product} />);
    const cartBtn = container.querySelector('[data-add-to-cart]')!;
    fireEvent.click(cartBtn);
    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      imagePath: '/fallback.jpg',
    }));
  });
});
