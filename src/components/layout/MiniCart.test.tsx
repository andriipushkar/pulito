// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockRemoveItem = vi.hoisted(() => vi.fn());
const mockUpdateQuantity = vi.hoisted(() => vi.fn());
const mockTotal = vi.hoisted(() => vi.fn().mockReturnValue(250));
const mockItems = vi.hoisted(() => [] as any[]);
const mockUser = vi.hoisted(() => ({ current: null as any }));

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({
    items: mockItems,
    total: mockTotal,
    removeItem: mockRemoveItem,
    updateQuantity: mockUpdateQuantity,
  }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser.current }) }));
vi.mock('@/components/icons', () => ({
  Trash: () => <span data-testid="trash-icon">trash</span>,
  Plus: () => <span data-testid="plus-icon">+</span>,
  Minus: () => <span data-testid="minus-icon">-</span>,
}));

import MiniCart from './MiniCart';

describe('MiniCart', () => {
  beforeEach(() => {
    mockItems.length = 0;
    mockUser.current = null;
    mockTotal.mockReturnValue(0);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty cart message', () => {
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.textContent).toContain('Кошик порожній');
  });

  it('renders dialog role', () => {
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
  });

  it('shows item count in header', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 2, priceRetail: '50.00', priceWholesale: null, imagePath: '/soap.jpg' },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.textContent).toContain('Кошик (1)');
  });

  it('renders items with images', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 2, priceRetail: '50.00', priceWholesale: null, imagePath: '/soap.jpg' },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/soap.jpg');
  });

  it('renders items without images (placeholder)', () => {
    mockItems.push(
      { productId: 2, name: 'NoImg', slug: 'noimg', quantity: 1, priceRetail: '30.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.querySelector('img')).toBeNull();
    // Should render a placeholder div
    expect(container.querySelector('.h-12.w-12')).toBeInTheDocument();
  });

  it('renders item name as link', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 1, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    const link = container.querySelector('a[href="/product/soap"]');
    expect(link).toBeInTheDocument();
    expect(link!.textContent).toBe('Soap');
  });

  it('shows retail price for regular user', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 2, priceRetail: '50.00', priceWholesale: '40.00', imagePath: null },
    );
    mockUser.current = null;
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.textContent).toContain('50.00');
  });

  it('shows wholesale price for wholesaler', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 2, priceRetail: '50.00', priceWholesale: '40.00', imagePath: null },
    );
    mockUser.current = { role: 'wholesaler' };
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.textContent).toContain('40.00');
  });

  it('calls updateQuantity with decremented value on minus click', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 3, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    const minusBtn = container.querySelector('button[aria-label="Зменшити"]')!;
    fireEvent.click(minusBtn);
    expect(mockUpdateQuantity).toHaveBeenCalledWith(1, 2);
  });

  it('calls updateQuantity with min 1 when quantity is 1', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 1, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    const minusBtn = container.querySelector('button[aria-label="Зменшити"]')!;
    fireEvent.click(minusBtn);
    expect(mockUpdateQuantity).toHaveBeenCalledWith(1, 1);
  });

  it('calls updateQuantity with incremented value on plus click', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 2, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    const plusBtn = container.querySelector('button[aria-label="Збільшити"]')!;
    fireEvent.click(plusBtn);
    expect(mockUpdateQuantity).toHaveBeenCalledWith(1, 3);
  });

  it('calls removeItem on trash click', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 1, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    const deleteBtn = container.querySelector('button[aria-label="Видалити"]')!;
    fireEvent.click(deleteBtn);
    expect(mockRemoveItem).toHaveBeenCalledWith(1);
  });

  it('displays cart total', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 2, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    mockTotal.mockReturnValue(100);
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.textContent).toContain('100.00 ₴');
    expect(container.textContent).toContain('Разом:');
  });

  it('renders cart and checkout links', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 1, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    expect(container.querySelector('a[href="/cart"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/checkout"]')).toBeInTheDocument();
  });

  it('calls onClose when clicking outside', () => {
    const onClose = vi.fn();
    render(<MiniCart onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside', () => {
    const onClose = vi.fn();
    const { container } = render(<MiniCart onClose={onClose} />);
    const dialog = container.querySelector('[role="dialog"]')!;
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when cart link is clicked', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 1, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const onClose = vi.fn();
    const { container } = render(<MiniCart onClose={onClose} />);
    const cartLink = container.querySelector('a[href="/cart"]')!;
    fireEvent.click(cartLink);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when item name link is clicked', () => {
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 1, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const onClose = vi.fn();
    const { container } = render(<MiniCart onClose={onClose} />);
    const nameLink = container.querySelector('a[href="/product/soap"]')!;
    fireEvent.click(nameLink);
    expect(onClose).toHaveBeenCalled();
  });

  it('becomes visible via requestAnimationFrame', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    mockItems.push(
      { productId: 1, name: 'Soap', slug: 'soap', quantity: 1, priceRetail: '50.00', priceWholesale: null, imagePath: null },
    );
    const { container } = render(<MiniCart onClose={vi.fn()} />);
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.className).toContain('translate-y-0');
    rafSpy.mockRestore();
  });
});
