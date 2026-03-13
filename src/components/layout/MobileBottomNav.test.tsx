// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.hoisted(() => vi.fn().mockResolvedValue({ success: false }));
const mockUser = vi.hoisted(() => ({ current: null as any }));
const mockItemCount = vi.hoisted(() => ({ current: 0 }));
const mockWishlistCount = vi.hoisted(() => ({ current: 0 }));
const mockPathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.current,
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ itemCount: mockItemCount.current }) }));
vi.mock('@/hooks/useWishlist', () => ({ useWishlist: () => ({ wishlistCount: mockWishlistCount.current }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser.current }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...args: any[]) => mockGet(...args) } }));
vi.mock('@/components/icons', () => ({
  Heart: () => <span data-testid="heart-icon">heart</span>,
  Cart: () => <span data-testid="cart-icon">cart</span>,
  User: () => <span data-testid="user-icon">user</span>,
}));
vi.mock('./MobileMenu', () => ({ default: ({ isOpen, onClose }: any) => isOpen ? <div data-testid="mobile-menu"><button onClick={onClose}>close-menu</button></div> : null }));

import MobileBottomNav from './MobileBottomNav';

describe('MobileBottomNav', () => {
  beforeEach(() => {
    mockUser.current = null;
    mockItemCount.current = 0;
    mockWishlistCount.current = 0;
    mockPathname.current = '/';
    mockGet.mockResolvedValue({ success: false });
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nav element', () => {
    const { container } = render(<MobileBottomNav categories={[]} />);
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    const { container } = render(<MobileBottomNav categories={[]} />);
    expect(container.textContent).toContain('Головна');
    expect(container.textContent).toContain('Каталог');
    expect(container.textContent).toContain('Кошик');
    expect(container.textContent).toContain('Профіль');
  });

  it('highlights active home link', () => {
    mockPathname.current = '/';
    const { container } = render(<MobileBottomNav categories={[]} />);
    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink!.className).toContain('text-[var(--color-primary)]');
  });

  it('highlights active catalog button', () => {
    mockPathname.current = '/catalog';
    const { container } = render(<MobileBottomNav categories={[]} />);
    const catalogBtn = container.querySelector('button');
    expect(catalogBtn!.className).toContain('text-[var(--color-primary)]');
  });

  it('highlights active cart link', () => {
    mockPathname.current = '/cart';
    const { container } = render(<MobileBottomNav categories={[]} />);
    const cartLink = container.querySelector('a[href="/cart"]');
    // The cart link should contain the text
    expect(cartLink!.textContent).toContain('Кошик');
    // Cart label span has active styling based on isActive('/cart')
    const spans = cartLink!.querySelectorAll('span');
    const cartLabelSpan = Array.from(spans).find(s => s.textContent === 'Кошик');
    expect(cartLabelSpan!.className).toContain('text-[var(--color-primary)]');
  });

  it('highlights active account link (not wishlist)', () => {
    mockPathname.current = '/account';
    const { container } = render(<MobileBottomNav categories={[]} />);
    const accountLink = container.querySelector('a[href="/account"]');
    expect(accountLink!.className).toContain('text-[var(--color-primary)]');
  });

  it('does not highlight account when on wishlist page', () => {
    mockPathname.current = '/account/wishlist';
    const { container } = render(<MobileBottomNav categories={[]} />);
    const accountLink = container.querySelector('a[href="/account"]');
    expect(accountLink!.className).toContain('text-[var(--color-text-secondary)]');
  });

  it('shows cart item count badge', () => {
    mockItemCount.current = 3;
    const { container } = render(<MobileBottomNav categories={[]} />);
    expect(container.textContent).toContain('3');
  });

  it('shows cart pulse animation when items > 0', () => {
    mockItemCount.current = 2;
    const { container } = render(<MobileBottomNav categories={[]} />);
    expect(container.querySelector('.animate-cart-pulse')).toBeInTheDocument();
  });

  it('does not show cart badge when count is 0', () => {
    mockItemCount.current = 0;
    const { container } = render(<MobileBottomNav categories={[]} />);
    expect(container.querySelector('.animate-cart-pulse')).toBeNull();
  });

  it('fetches notification count when user is logged in', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: { count: 3 } });
    render(<MobileBottomNav categories={[]} />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/v1/me/notifications/count');
    });
  });

  it('does not fetch notifications when no user', () => {
    mockUser.current = null;
    render(<MobileBottomNav categories={[]} />);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('shows unread notification badge on profile', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: { count: 5 } });
    const { container } = render(<MobileBottomNav categories={[]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('5');
    });
  });

  it('shows 9+ when unread count exceeds 9', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: { count: 15 } });
    const { container } = render(<MobileBottomNav categories={[]} />);
    await waitFor(() => {
      expect(container.textContent).toContain('9+');
    });
  });

  it('opens mobile menu on catalog button click', () => {
    const { container, getByTestId } = render(<MobileBottomNav categories={[]} />);
    const catalogBtn = container.querySelector('button')!;
    fireEvent.click(catalogBtn);
    expect(getByTestId('mobile-menu')).toBeInTheDocument();
  });

  it('closes mobile menu via onClose', () => {
    const { container, queryByTestId, getByText } = render(<MobileBottomNav categories={[]} />);
    const catalogBtn = container.querySelector('button')!;
    fireEvent.click(catalogBtn);
    expect(queryByTestId('mobile-menu')).toBeInTheDocument();
    fireEvent.click(getByText('close-menu'));
    expect(queryByTestId('mobile-menu')).not.toBeInTheDocument();
  });

  it('hides nav on scroll down and shows on scroll up', () => {
    const { container } = render(<MobileBottomNav categories={[]} />);
    const nav = container.querySelector('nav')!;

    // Initially visible
    expect(nav.className).toContain('translate-y-0');

    // Scroll down past threshold
    Object.defineProperty(window, 'scrollY', { value: 200, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });

    // Should be hidden
    Object.defineProperty(window, 'scrollY', { value: 250, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(nav.className).toContain('translate-y-full');

    // Scroll up
    Object.defineProperty(window, 'scrollY', { value: 220, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(nav.className).toContain('translate-y-0');
  });

  it('always shows nav when scrollY < 100', () => {
    const { container } = render(<MobileBottomNav categories={[]} />);
    const nav = container.querySelector('nav')!;

    Object.defineProperty(window, 'scrollY', { value: 50, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(nav.className).toContain('translate-y-0');
  });

  it('handles notification fetch failure gracefully', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockRejectedValue(new Error('Network error'));
    const { container } = render(<MobileBottomNav categories={[]} />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
    // Should not crash
    expect(container.querySelector('nav')).toBeInTheDocument();
  });
});
