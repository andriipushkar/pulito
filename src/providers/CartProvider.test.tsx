// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import CartProvider, { CartContext, type CartItem } from './CartProvider';

const mockAuthValue = { user: null as { id: number; email: string; role: string; fullName: string } | null };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock('swr', () => ({
  default: () => ({ data: undefined }),
  mutate: vi.fn(),
}));

vi.mock('@/lib/swr', () => ({
  fetcher: vi.fn(),
}));

const makeItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  productId: 1,
  name: 'Test Product',
  slug: 'test-product',
  code: 'TP01',
  priceRetail: 100,
  priceWholesale: 80,
  imagePath: null,
  quantity: 1,
  maxQuantity: 10,
  ...overrides,
});

function TestConsumer() {
  const { items, itemCount, total, addItem, removeItem, updateQuantity, clearCart } = useContext(CartContext);
  return (
    <div>
      <div data-testid="count">{itemCount}</div>
      <div data-testid="items">{JSON.stringify(items)}</div>
      <div data-testid="total">{total()}</div>
      <div data-testid="total-wholesale">{total('wholesaler')}</div>
      <button data-testid="add" onClick={() => addItem(makeItem())}>Add</button>
      <button data-testid="add-second" onClick={() => addItem(makeItem({ productId: 2, name: 'Second', slug: 'second', code: 'S01', priceRetail: 200, quantity: 1 }))}>Add Second</button>
      <button data-testid="remove" onClick={() => removeItem(1)}>Remove</button>
      <button data-testid="update" onClick={() => updateQuantity(1, 5)}>Update Qty</button>
      <button data-testid="update-over-max" onClick={() => updateQuantity(1, 99)}>Update Over Max</button>
      <button data-testid="update-below-min" onClick={() => updateQuantity(1, 0)}>Update Below Min</button>
      <button data-testid="clear" onClick={() => clearCart()}>Clear</button>
    </div>
  );
}

describe('CartProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthValue.user = null;
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('provides cart context with empty state', () => {
    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    expect(screen.getByTestId('items').textContent).toBe('[]');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('addItem increases item count', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId('items').textContent!);
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe(1);
    });
  });

  it('addItem merges quantity for same product', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));
    await user.click(screen.getByTestId('add'));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId('items').textContent!);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
    });
  });

  it('removeItem removes product from cart', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('items').textContent!)).toHaveLength(1);
    });

    await user.click(screen.getByTestId('remove'));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('items').textContent!)).toHaveLength(0);
    });
  });

  it('updateQuantity changes item quantity', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));
    await user.click(screen.getByTestId('update'));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId('items').textContent!);
      expect(items[0].quantity).toBe(5);
    });
  });

  it('updateQuantity enforces maxQuantity limit', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));
    await user.click(screen.getByTestId('update-over-max'));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId('items').textContent!);
      expect(items[0].quantity).toBe(10);
    });
  });

  it('updateQuantity enforces minimum quantity of 1', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));
    await user.click(screen.getByTestId('update-below-min'));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId('items').textContent!);
      expect(items[0].quantity).toBe(1);
    });
  });

  it('clearCart empties the cart', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));
    await user.click(screen.getByTestId('add-second'));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('items').textContent!)).toHaveLength(2);
    });

    await user.click(screen.getByTestId('clear'));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('items').textContent!)).toHaveLength(0);
    });
  });

  it('computes total using retail price by default', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));

    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('100');
    });
  });

  it('computes total using wholesale price when role is wholesaler', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));

    await waitFor(() => {
      expect(screen.getByTestId('total-wholesale').textContent).toBe('80');
    });
  });

  it('persists to localStorage for anonymous users', async () => {
    const user = userEvent.setup();

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await user.click(screen.getByTestId('add'));

    await waitFor(() => {
      const stored = localStorage.getItem('clean-shop-cart');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });
  });

  it('loads from localStorage for anonymous users', async () => {
    const savedItems = [makeItem({ quantity: 3 })];
    localStorage.setItem('clean-shop-cart', JSON.stringify(savedItems));

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>
    );

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId('items').textContent!);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(3);
    });
  });
});
