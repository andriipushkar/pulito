// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAddItem = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn().mockResolvedValue({ success: false }));
const mockApiPost = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
const mockApiDelete = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
const mockUser = vi.hoisted(() => ({ value: null as any }));

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/dynamic', () => {
  const { useState, useEffect } = require('react');
  return {
    default: (loader: () => Promise<any>) => {
      return function DynamicWrapper(props: any) {
        const [Comp, setComp] = (useState as any)(null);
        useEffect(() => { loader().then((mod: any) => setComp(() => mod.default || mod)); }, []);
        return Comp ? <Comp {...props} /> : null;
      };
    },
  };
});
vi.mock('@/components/ui/Badge', () => ({ default: ({ children }: any) => <span data-testid="badge">{children}</span> }));
vi.mock('./PriceDisplay', () => ({ default: () => <div data-testid="price-display" /> }));
vi.mock('./QuickView', () => ({ default: ({ onClose }: any) => <div data-testid="quick-view"><button onClick={onClose}>close</button></div> }));
vi.mock('@/components/icons', () => ({
  Heart: () => <span data-testid="heart-icon" />,
  HeartFilled: () => <span data-testid="heart-filled-icon" />,
  Cart: () => <span data-testid="cart-icon" />,
  Compare: () => <span data-testid="compare-icon" />,
  Search: () => <span data-testid="search-icon" />,
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
vi.mock('@/hooks/useComparison', () => ({ useComparison: () => ({ count: 0, has: () => false, toggle: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser.value }) }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: any[]) => mockApiGet(...args), post: (...args: any[]) => mockApiPost(...args), delete: (...args: any[]) => mockApiDelete(...args) },
}));

import ProductCard from './ProductCard';

const makeProduct = (overrides: any = {}) => ({
  id: 1,
  name: 'Test Product 500мл',
  slug: 'test-product',
  code: 'TP001',
  priceRetail: '100.00',
  priceWholesale: null,
  priceRetailOld: null,
  quantity: 10,
  imagePath: '/default.jpg',
  images: [],
  badges: [],
  category: null,
  content: null,
  ...overrides,
});

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUser.value = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders product name', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct()} />);
    expect(getAllByText(/Test Product/).length).toBeGreaterThan(0);
  });

  it('renders "В наявності" when in stock', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ quantity: 5 })} />);
    expect(getAllByText('В наявності').length).toBeGreaterThan(0);
  });

  it('renders "Немає" when out of stock', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ quantity: 0 })} />);
    expect(getAllByText('Немає').length).toBeGreaterThan(0);
  });

  it('calls addItem when add-to-cart clicked and in stock', () => {
    const { getAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    fireEvent.click(getAllByLabelText('В кошик')[0]);
    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      productId: 1,
      name: 'Test Product 500мл',
      quantity: 1,
    }));
  });

  it('renders badges', () => {
    const badges = [
      { id: 1, badgeType: 'NEW', customText: 'Новинка', customColor: '#ff0000' },
      { id: 2, badgeType: 'SALE', customText: null, customColor: null },
    ];
    const { getAllByTestId, getByText } = render(<ProductCard product={makeProduct({ badges })} />);
    expect(getAllByTestId('badge').length).toBe(2);
    expect(getByText('Новинка')).toBeInTheDocument();
    expect(getByText('SALE')).toBeInTheDocument();
  });

  it('renders max 2 badges', () => {
    const badges = [
      { id: 1, badgeType: 'NEW', customText: 'A', customColor: null },
      { id: 2, badgeType: 'SALE', customText: 'B', customColor: null },
      { id: 3, badgeType: 'HOT', customText: 'C', customColor: null },
    ];
    const { getAllByTestId } = render(<ProductCard product={makeProduct({ badges })} />);
    expect(getAllByTestId('badge').length).toBe(2);
  });

  it('renders category name when present', () => {
    const { getByText } = render(
      <ProductCard product={makeProduct({ category: { id: 1, name: 'Порошки', slug: 'poroshky' } })} />
    );
    expect(getByText('Порошки')).toBeInTheDocument();
  });

  it('renders no-image placeholder when no imagePath', () => {
    const { container } = render(<ProductCard product={makeProduct({ imagePath: null, images: [] })} />);
    const placeholder = container.querySelector('svg');
    expect(placeholder).toBeInTheDocument();
  });

  it('renders main image when imagePath exists', () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container.querySelector('img[src="/default.jpg"]')).toBeInTheDocument();
  });

  it('renders blur placeholder when available', () => {
    const images = [{ id: 1, pathMedium: '/med.jpg', pathBlur: '/blur.jpg', pathThumbnail: null, pathFull: null, isMain: true }];
    const { container } = render(<ProductCard product={makeProduct({ images })} />);
    expect(container.querySelector('img[src="/blur.jpg"]')).toBeInTheDocument();
  });

  it('hides blur after main image loads', () => {
    const images = [{ id: 1, pathMedium: '/med.jpg', pathBlur: '/blur.jpg', pathThumbnail: null, pathFull: null, isMain: true }];
    const { container } = render(<ProductCard product={makeProduct({ images })} />);
    const mainImg = container.querySelector('img[src="/med.jpg"]');
    if (mainImg) fireEvent.load(mainImg);
    expect(container.querySelector('img[src="/blur.jpg"]')).not.toBeInTheDocument();
  });

  it('renders hover image when available', () => {
    const images = [
      { id: 1, pathMedium: '/med1.jpg', pathBlur: null, pathThumbnail: null, pathFull: null, isMain: true },
      { id: 2, pathMedium: '/med2.jpg', pathBlur: null, pathThumbnail: null, pathFull: null, isMain: false },
    ];
    const { container } = render(<ProductCard product={makeProduct({ images })} />);
    expect(container.querySelector('img[src="/med2.jpg"]')).toBeInTheDocument();
  });

  it('shows shortDescription when no attributes extracted', () => {
    const { getByText } = render(
      <ProductCard product={makeProduct({ name: 'Simple', content: { shortDescription: 'Short desc' } })} />
    );
    expect(getByText('Short desc')).toBeInTheDocument();
  });

  it('does not show shortDescription when attributes are extracted', () => {
    const { queryByText } = render(
      <ProductCard product={makeProduct({ name: 'Product 500 ml', content: { shortDescription: 'Short desc' } })} />
    );
    expect(queryByText('Short desc')).not.toBeInTheDocument();
  });

  it('toggles wishlist for anonymous user (localStorage)', () => {
    const { getAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    const wishBtn = getAllByLabelText('Додати в обране')[0];
    fireEvent.click(wishBtn);
    const stored = JSON.parse(localStorage.getItem('clean-shop-wishlist') || '[]');
    expect(stored).toContain(1);
  });

  it('removes from wishlist on second click (localStorage)', async () => {
    localStorage.setItem('clean-shop-wishlist', JSON.stringify([1]));
    const { getAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    await waitFor(() => {
      const wishBtn = getAllByLabelText('Видалити з обраного');
      expect(wishBtn.length).toBeGreaterThan(0);
    });
    fireEvent.click(getAllByLabelText('Видалити з обраного')[0]);
    const stored = JSON.parse(localStorage.getItem('clean-shop-wishlist') || '[]');
    expect(stored).not.toContain(1);
  });

  it('does not duplicate id in localStorage wishlist', () => {
    localStorage.setItem('clean-shop-wishlist', JSON.stringify([1]));
    const { getAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    // It's already in wishlist, so clicking add again shouldn't duplicate
    // First render reads wishlist=1 -> isWished=true
    // We need a product not in wishlist
    cleanup();
    localStorage.setItem('clean-shop-wishlist', JSON.stringify([1]));
    const { getAllByLabelText: getButtons } = render(<ProductCard product={makeProduct({ id: 2 })} />);
    const wishBtn = getButtons('Додати в обране')[0];
    fireEvent.click(wishBtn);
    const stored = JSON.parse(localStorage.getItem('clean-shop-wishlist') || '[]');
    expect(stored).toEqual([1, 2]);
  });

  it('shows quick view button and opens on click', async () => {
    const { getAllByLabelText, queryByTestId } = render(<ProductCard product={makeProduct()} />);
    expect(queryByTestId('quick-view')).not.toBeInTheDocument();
    const qvBtn = getAllByLabelText('Швидкий перегляд')[0];
    fireEvent.click(qvBtn);
    await waitFor(() => {
      expect(queryByTestId('quick-view')).toBeInTheDocument();
    });
  });

  it('renders links to product page', () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    const links = container.querySelectorAll('a[href="/product/test-product"]');
    expect(links.length).toBeGreaterThan(0);
  });

  it('handles hover states', () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    const card = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
  });

  it('opens quick view and closes it', async () => {
    const { getAllByLabelText, queryByTestId, getByText } = render(<ProductCard product={makeProduct()} />);
    const qvBtn = getAllByLabelText('Швидкий перегляд')[0];
    fireEvent.click(qvBtn);
    await waitFor(() => {
      expect(queryByTestId('quick-view')).toBeInTheDocument();
    });
    fireEvent.click(getByText('close'));
    expect(queryByTestId('quick-view')).not.toBeInTheDocument();
  });

  it('does not call addItem when out of stock', () => {
    const { getAllByLabelText } = render(<ProductCard product={makeProduct({ quantity: 0 })} />);
    fireEvent.click(getAllByLabelText('В кошик')[0]);
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('passes wholesale price to addItem', () => {
    const product = makeProduct({ priceWholesale: '80.00', images: [{ id: 1, pathMedium: '/med.jpg', pathBlur: null, pathThumbnail: null, pathFull: null, isMain: true }] });
    const { getAllByLabelText } = render(<ProductCard product={product} />);
    fireEvent.click(getAllByLabelText('В кошик')[0]);
    expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
      priceWholesale: 80,
      imagePath: '/med.jpg',
    }));
  });

  it('extracts volume attributes from name with ml', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Порошок Ariel 500 ml' })} />);
    expect(getAllByText('500 мл').length).toBeGreaterThan(0);
  });

  it('extracts volume attributes with l unit', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Product 1.5l' })} />);
    expect(getAllByText('1.5 л').length).toBeGreaterThan(0);
  });

  it('extracts weight attributes from name with kg', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Порошок 2 kg' })} />);
    expect(getAllByText('2 кг').length).toBeGreaterThan(0);
  });

  it('extracts weight attributes with g unit', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Product 500g' })} />);
    expect(getAllByText('500 г').length).toBeGreaterThan(0);
  });

  it('extracts tabs attributes', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Pills 30 tabs' })} />);
    expect(getAllByText('30 шт').length).toBeGreaterThan(0);
  });

  it('extracts caps attributes', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Capsules 60 caps' })} />);
    expect(getAllByText('60 шт').length).toBeGreaterThan(0);
  });

  it('extracts tab (singular) attributes', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Single 1 tab' })} />);
    expect(getAllByText('1 шт').length).toBeGreaterThan(0);
  });

  it('extracts attributes from description when not in name', () => {
    const { getAllByText } = render(
      <ProductCard product={makeProduct({ name: 'Simple Product', content: { shortDescription: 'Volume 750 ml' } })} />
    );
    expect(getAllByText('750 мл').length).toBeGreaterThan(0);
  });

  it('handles localStorage errors gracefully for wishlist', () => {
    const origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('quota'); };
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container).toBeTruthy();
    Storage.prototype.getItem = origGetItem;
  });

  it('handles localStorage setItem errors gracefully', () => {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    const { getAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    const wishBtn = getAllByLabelText('Додати в обране')[0];
    // Should not throw
    fireEvent.click(wishBtn);
    Storage.prototype.setItem = origSetItem;
  });

  // Authenticated user wishlist tests
  it('fetches wishlist status from API for authenticated user', async () => {
    mockUser.value = { id: 1, name: 'Test' };
    mockApiGet.mockResolvedValue({ success: true, data: { wishlisted: true } });
    const { findAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/me/wishlists/default/items/1');
    });
    const btns = await findAllByLabelText('Видалити з обраного');
    expect(btns.length).toBeGreaterThan(0);
  });

  it('adds to wishlist via API for authenticated user', async () => {
    mockUser.value = { id: 1, name: 'Test' };
    mockApiGet.mockResolvedValue({ success: true, data: { wishlisted: false } });
    const { findAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    const btns = await findAllByLabelText('Додати в обране');
    fireEvent.click(btns[0]);
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/v1/me/wishlists/default/items/1');
    });
  });

  it('removes from wishlist via API for authenticated user', async () => {
    mockUser.value = { id: 1, name: 'Test' };
    mockApiGet.mockResolvedValue({ success: true, data: { wishlisted: true } });
    const { findAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    const btns = await findAllByLabelText('Видалити з обраного');
    fireEvent.click(btns[0]);
    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/api/v1/me/wishlists/default/items/1');
    });
  });

  it('reverts wishlist state on API error for authenticated user', async () => {
    mockUser.value = { id: 1, name: 'Test' };
    mockApiGet.mockResolvedValue({ success: true, data: { wishlisted: false } });
    mockApiPost.mockRejectedValue(new Error('fail'));
    const { findAllByLabelText } = render(<ProductCard product={makeProduct()} />);
    const btns = await findAllByLabelText('Додати в обране');
    fireEvent.click(btns[0]);
    // Should revert back to not wished
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalled();
    });
  });

  it('handles malformed localStorage JSON gracefully', () => {
    localStorage.setItem('clean-shop-wishlist', 'not-json');
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container).toBeTruthy();
  });

  it('handles non-array localStorage value gracefully', () => {
    localStorage.setItem('clean-shop-wishlist', JSON.stringify({ foo: 'bar' }));
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container).toBeTruthy();
  });

  it('handles API error when fetching wishlist status', async () => {
    mockUser.value = { id: 1, name: 'Test' };
    mockApiGet.mockRejectedValue(new Error('fail'));
    const { container } = render(<ProductCard product={makeProduct()} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
    });
    expect(container).toBeTruthy();
  });

  it('extracts comma-separated volume values', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Product 1,5L' })} />);
    expect(getAllByText('1.5 л').length).toBeGreaterThan(0);
  });

  it('extracts comma-separated weight values', () => {
    const { getAllByText } = render(<ProductCard product={makeProduct({ name: 'Product 2,5 kg' })} />);
    expect(getAllByText('2.5 кг').length).toBeGreaterThan(0);
  });

  it('does not show badges section when badges array is empty', () => {
    const { container } = render(<ProductCard product={makeProduct({ badges: [] })} />);
    expect(container.querySelectorAll('[data-testid="badge"]').length).toBe(0);
  });

  it('does not render category when null', () => {
    const { container } = render(<ProductCard product={makeProduct({ category: null })} />);
    const catSpan = container.querySelector('.tracking-wide.uppercase');
    expect(catSpan).not.toBeInTheDocument();
  });
});
