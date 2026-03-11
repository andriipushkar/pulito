// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAddItem = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
vi.mock('@/components/icons', () => ({ Cart: () => <span>cart</span> }));

import FloatingBuyBar from './FloatingBuyBar';

const baseProps = {
  productId: 1,
  name: 'Test Product',
  slug: 'test-product',
  code: 'TP1',
  priceRetail: 100,
  priceWholesale: null as number | null,
  imagePath: null as string | null,
  quantity: 10,
};

describe('FloatingBuyBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders bar for in-stock product', () => {
    const { container } = render(<FloatingBuyBar {...baseProps} />);
    expect(container.textContent).toContain('В кошик');
  });

  it('returns null when out of stock', () => {
    const { container } = render(<FloatingBuyBar {...baseProps} quantity={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('displays product name and price', () => {
    const { getByText } = render(<FloatingBuyBar {...baseProps} />);
    expect(getByText('Test Product')).toBeInTheDocument();
    expect(getByText('100.00 ₴')).toBeInTheDocument();
  });

  it('calls addItem when buy button is clicked', () => {
    const { getByText } = render(<FloatingBuyBar {...baseProps} priceWholesale={80} imagePath="/img.jpg" />);
    fireEvent.click(getByText('В кошик'));
    expect(mockAddItem).toHaveBeenCalledWith({
      productId: 1,
      name: 'Test Product',
      slug: 'test-product',
      code: 'TP1',
      priceRetail: 100,
      priceWholesale: 80,
      imagePath: '/img.jpg',
      quantity: 1,
      maxQuantity: 10,
    });
  });

  it('becomes visible when scrollY > 400 and no add-to-cart button exists', () => {
    const { container } = render(<FloatingBuyBar {...baseProps} />);
    const bar = container.firstChild as HTMLElement;
    // Initially has translate-y-full (not visible)
    expect(bar.className).toContain('translate-y-full');

    // Simulate scroll with no data-add-to-cart element
    Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(bar.className).toContain('translate-y-0');
  });

  it('stays hidden when scrollY <= 400 and no add-to-cart button exists', () => {
    const { container } = render(<FloatingBuyBar {...baseProps} />);
    const bar = container.firstChild as HTMLElement;

    Object.defineProperty(window, 'scrollY', { value: 200, writable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(bar.className).toContain('translate-y-full');
  });

  it('becomes visible when add-to-cart button is scrolled above viewport', () => {
    // Create a fake add-to-cart button in the DOM
    const fakeBtn = document.createElement('button');
    fakeBtn.setAttribute('data-add-to-cart', '');
    fakeBtn.getBoundingClientRect = () => ({
      top: -100,
      bottom: -50,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    document.body.appendChild(fakeBtn);

    const { container } = render(<FloatingBuyBar {...baseProps} />);
    const bar = container.firstChild as HTMLElement;

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(bar.className).toContain('translate-y-0');

    document.body.removeChild(fakeBtn);
  });

  it('stays hidden when add-to-cart button is in viewport', () => {
    const fakeBtn = document.createElement('button');
    fakeBtn.setAttribute('data-add-to-cart', '');
    fakeBtn.getBoundingClientRect = () => ({
      top: 100,
      bottom: 150,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    document.body.appendChild(fakeBtn);

    const { container } = render(<FloatingBuyBar {...baseProps} />);
    const bar = container.firstChild as HTMLElement;

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(bar.className).toContain('translate-y-full');

    document.body.removeChild(fakeBtn);
  });

  it('removes scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<FloatingBuyBar {...baseProps} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });
});
