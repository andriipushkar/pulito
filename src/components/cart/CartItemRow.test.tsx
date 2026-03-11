// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/image', () => ({ default: (props: any) => <img {...props} /> }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/icons', () => ({ Trash: () => <span data-testid="trash-icon" /> }));
vi.mock('@/components/product/QuantitySelector', () => ({
  default: ({ value, onChange, max, className }: any) => (
    <div data-testid="qty-selector" data-value={value} data-max={max} className={className}>
      <button data-testid="qty-change" onClick={() => onChange(value + 1)}>+</button>
    </div>
  ),
}));

import CartItemRow from './CartItemRow';

const mockItem = {
  productId: 1,
  name: 'Test Item',
  slug: 'test-item',
  code: 'TI001',
  priceRetail: 100,
  priceWholesale: null,
  imagePath: null,
  quantity: 2,
  maxQuantity: 10,
} as any;

const mockItemWithImage = {
  ...mockItem,
  imagePath: '/images/product.jpg',
};

describe('CartItemRow', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it('renders item name as a link', () => {
    render(<CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />);
    const links = screen.getAllByText('Test Item');
    expect(links[0].closest('a')).toHaveAttribute('href', '/product/test-item');
  });

  it('renders item code', () => {
    render(<CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getAllByText(/Код: TI001/).length).toBeGreaterThan(0);
  });

  it('renders subtotal correctly (price * quantity)', () => {
    render(<CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />);
    // subtotal = 100 * 2 = 200.00
    expect(screen.getAllByText('200.00 ₴').length).toBeGreaterThan(0);
  });

  it('renders placeholder when imagePath is null', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders image when imagePath is provided', () => {
    const { container } = render(<CartItemRow item={mockItemWithImage} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />);
    const img = container.querySelector('img[alt="Test Item"]');
    expect(img).toHaveAttribute('src', '/images/product.jpg');
  });

  it('calls onRemove when desktop remove button clicked', () => {
    const onRemove = vi.fn();
    const { container } = render(<CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={onRemove} />);
    const removeButtons = container.querySelectorAll('[aria-label="Видалити"]');
    fireEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('calls onUpdateQuantity when QuantitySelector changes', () => {
    const onUpdateQuantity = vi.fn();
    const { container } = render(<CartItemRow item={mockItem} onUpdateQuantity={onUpdateQuantity} onRemove={vi.fn()} />);
    const qtyBtn = container.querySelector('[data-testid="qty-change"]') as HTMLElement;
    fireEvent.click(qtyBtn);
    expect(onUpdateQuantity).toHaveBeenCalledWith(1, 3);
  });

  it('renders unit price', () => {
    render(<CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getAllByText('100.00 ₴').length).toBeGreaterThan(0);
  });

  // Swipe-to-delete tests
  it('handles touch start', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    fireEvent.touchStart(slideable, { touches: [{ clientX: 300 }] });
    // swiping state is internal, but no crash
    expect(slideable).toBeTruthy();
  });

  it('handles touch move left swipe', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    fireEvent.touchStart(slideable, { touches: [{ clientX: 300 }] });
    fireEvent.touchMove(slideable, { touches: [{ clientX: 200 }] });
    // offset should be 100, within reveal range
    expect(slideable.style.transform).toContain('translateX');
  });

  it('touch end with small swipe snaps back to 0', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    fireEvent.touchStart(slideable, { touches: [{ clientX: 300 }] });
    fireEvent.touchMove(slideable, { touches: [{ clientX: 270 }] }); // diff=30, < SWIPE_THRESHOLD(80)
    fireEvent.touchEnd(slideable);
    expect(slideable.style.transform).toBe('translateX(-0px)');
  });

  it('touch end with medium swipe snaps to reveal delete', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    fireEvent.touchStart(slideable, { touches: [{ clientX: 300 }] });
    fireEvent.touchMove(slideable, { touches: [{ clientX: 210 }] }); // diff=90, >= 80 but < 160
    fireEvent.touchEnd(slideable);
    expect(slideable.style.transform).toBe('translateX(-80px)');
  });

  it('touch end with large swipe triggers remove', () => {
    vi.useFakeTimers();
    const onRemove = vi.fn();
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={onRemove} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    fireEvent.touchStart(slideable, { touches: [{ clientX: 400 }] });
    fireEvent.touchMove(slideable, { touches: [{ clientX: 230 }] }); // diff=170, >= REMOVE_THRESHOLD(160)
    fireEvent.touchEnd(slideable);
    expect(slideable.style.transform).toBe('translateX(-500px)');
    vi.advanceTimersByTime(200);
    expect(onRemove).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('does not move when touch move fired without swiping state', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    // touchMove without touchStart
    fireEvent.touchMove(slideable, { touches: [{ clientX: 200 }] });
    expect(slideable.style.transform).toBe('translateX(-0px)');
  });

  it('clamps swipe offset at max value', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    fireEvent.touchStart(slideable, { touches: [{ clientX: 500 }] });
    fireEvent.touchMove(slideable, { touches: [{ clientX: 0 }] }); // diff=500, clamped to 192
    // clamped to REMOVE_THRESHOLD * 1.2 = 192
    expect(slideable.style.transform).toBe('translateX(-192px)');
  });

  it('calls onRemove when desktop (second) remove button is clicked', () => {
    const onRemove = vi.fn();
    const { container } = render(<CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={onRemove} />);
    const removeButtons = container.querySelectorAll('[aria-label="Видалити"]');
    // The second remove button is the desktop one (hidden sm:block)
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('does not allow right swipe (negative offset)', () => {
    const { container } = render(
      <CartItemRow item={mockItem} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />
    );
    const slideable = container.querySelector('[style]') as HTMLElement;
    fireEvent.touchStart(slideable, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(slideable, { touches: [{ clientX: 200 }] }); // diff=-100, clamped to 0
    expect(slideable.style.transform).toBe('translateX(-0px)');
  });
});
