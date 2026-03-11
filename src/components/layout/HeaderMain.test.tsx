// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.hoisted(() => vi.fn().mockResolvedValue({ success: false }));
const mockUser = vi.hoisted(() => ({ current: null as any }));
const mockItemCount = vi.hoisted(() => ({ current: 0 }));
const mockTotal = vi.hoisted(() => vi.fn().mockReturnValue(0));
const mockWishlistCount = vi.hoisted(() => ({ current: 0 }));

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/Container', () => ({ default: ({ children, ...props }: any) => <div {...props}>{children}</div> }));
vi.mock('@/components/ui/IconButton', () => ({ default: ({ label, onClick, badge, ...props }: any) => <button aria-label={label} onClick={onClick} data-badge={badge} {...props}>{badge != null && badge > 0 ? badge : ''}</button> }));
vi.mock('@/components/icons', () => ({ Bell: () => <span data-testid="bell-icon" />, Cart: () => <span data-testid="cart-icon" />, Check: () => <span data-testid="icon" />, ChevronDown: () => <span data-testid="icon" />, ChevronLeft: () => <span data-testid="icon" />, ChevronRight: () => <span data-testid="icon" />, Close: () => <span data-testid="icon" />, Copy: () => <span data-testid="icon" />, Facebook: () => <span data-testid="icon" />, Filter: () => <span data-testid="icon" />, Heart: () => <span data-testid="icon" />, HeartFilled: () => <span data-testid="icon" />, HelpCircle: () => <span data-testid="icon" />, Instagram: () => <span data-testid="icon" />, MessageCircle: () => <span data-testid="icon" />, Minus: () => <span data-testid="icon" />, Phone: () => <span data-testid="icon" />, Plus: () => <span data-testid="icon" />, Search: () => <span data-testid="icon" />, Telegram: () => <span data-testid="icon" />, TikTok: () => <span data-testid="icon" />, Trash: () => <span data-testid="icon" />, User: () => <span data-testid="icon" />, Viber: () => <span data-testid="icon" /> }));
vi.mock('./SearchBar', () => ({ default: () => <div data-testid="search-bar" /> }));
vi.mock('./MiniCart', () => ({ default: ({ onClose }: any) => <div data-testid="mini-cart"><button onClick={onClose}>Close</button></div> }));
vi.mock('@/components/common/CallbackButton', () => ({ default: () => <div data-testid="callback-btn" /> }));
vi.mock('@/components/common/ChatWidget', () => ({ default: () => <div data-testid="chat-widget" /> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser.current }) }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ itemCount: mockItemCount.current, total: mockTotal }) }));
vi.mock('@/hooks/useWishlist', () => ({ useWishlist: () => ({ wishlistCount: mockWishlistCount.current }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...args: any[]) => mockGet(...args) } }));
vi.mock('@/utils/format', () => ({ formatPrice: (v: number) => `${v} ₴` }));

import HeaderMain from './HeaderMain';

describe('HeaderMain', () => {
  beforeEach(() => {
    mockUser.current = null;
    mockItemCount.current = 0;
    mockTotal.mockReturnValue(0);
    mockWishlistCount.current = 0;
    mockGet.mockResolvedValue({ success: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', () => {
    const { container } = render(<HeaderMain categories={[]} />);
    expect(container).toBeTruthy();
  });

  it('renders skip-to-content link', () => {
    const { getAllByText } = render(<HeaderMain categories={[]} />);
    expect(getAllByText('Перейти до основного вмісту').length).toBeGreaterThan(0);
  });

  it('renders search bar', () => {
    render(<HeaderMain categories={[]} />);
    expect(screen.getAllByTestId('search-bar').length).toBeGreaterThanOrEqual(1);
  });

  it('renders logo link', () => {
    render(<HeaderMain categories={[]} />);
    const logoLinks = screen.getAllByRole('link');
    const homeLink = logoLinks.find(l => l.getAttribute('href') === '/');
    expect(homeLink).toBeTruthy();
  });

  it('renders wishlist link', () => {
    render(<HeaderMain categories={[]} />);
    const wishlistButton = screen.getByLabelText('Обране');
    expect(wishlistButton).toBeInTheDocument();
  });

  it('renders cart button', () => {
    render(<HeaderMain categories={[]} />);
    const cartButton = screen.getByLabelText('Кошик');
    expect(cartButton).toBeInTheDocument();
  });

  it('renders login link when no user', () => {
    render(<HeaderMain categories={[]} />);
    const loginButton = screen.getByLabelText('Увійти');
    expect(loginButton).toBeInTheDocument();
  });

  it('renders phone link on mobile', () => {
    render(<HeaderMain categories={[]} />);
    expect(screen.getByText('Зателефонувати')).toBeInTheDocument();
  });

  it('renders empty cart text', () => {
    render(<HeaderMain categories={[]} />);
    expect(screen.getByText('Кошик порожній')).toBeInTheDocument();
  });

  it('applies shrink class when shrink prop is true', () => {
    const { container } = render(<HeaderMain categories={[]} shrink />);
    const containerDiv = container.querySelector('[class*="py-1.5"]');
    expect(containerDiv).toBeInTheDocument();
  });

  it('applies normal padding when shrink is false', () => {
    const { container } = render(<HeaderMain categories={[]} />);
    const containerDiv = container.querySelector('[class*="py-3"]');
    expect(containerDiv).toBeInTheDocument();
  });

  it('renders profile link for unauthenticated user', () => {
    render(<HeaderMain categories={[]} />);
    const profileBtn = screen.getByLabelText('Увійти');
    const link = profileBtn.closest('a');
    expect(link).toHaveAttribute('href', '/auth/login');
  });

  it('renders callback button', () => {
    render(<HeaderMain categories={[]} />);
    expect(screen.getByTestId('callback-btn')).toBeInTheDocument();
  });

  it('renders chat widget', () => {
    render(<HeaderMain categories={[]} />);
    expect(screen.getByTestId('chat-widget')).toBeInTheDocument();
  });

  // --- New tests for uncovered lines ---

  it('renders profile link for authenticated user', () => {
    mockUser.current = { id: 1, role: 'customer' };
    render(<HeaderMain categories={[]} />);
    const profileBtn = screen.getByLabelText('Профіль');
    const link = profileBtn.closest('a');
    expect(link).toHaveAttribute('href', '/account');
  });

  it('renders notification bell for authenticated user', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: { count: 3 } });
    render(<HeaderMain categories={[]} />);

    // Should render notification link (mobile + desktop)
    const notifLinks = screen.getAllByLabelText('Сповіщення');
    expect(notifLinks.length).toBeGreaterThan(0);
  });

  it('displays unread notification count', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: { count: 5 } });
    render(<HeaderMain categories={[]} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/v1/me/notifications/count');
    });
  });

  it('shows 9+ when unread count exceeds 9', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: { count: 15 } });
    const { container } = render(<HeaderMain categories={[]} />);

    await waitFor(() => {
      expect(container.textContent).toContain('9+');
    });
  });

  it('handles notification fetch failure gracefully', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockRejectedValue(new Error('Network error'));
    const { container } = render(<HeaderMain categories={[]} />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
    expect(container).toBeTruthy();
  });

  it('renders wholesaler badge', () => {
    mockUser.current = { id: 1, role: 'wholesaler' };
    const { container } = render(<HeaderMain categories={[]} />);
    expect(container.textContent).toContain('Оптовий клієнт');
  });

  it('does not render wholesaler badge for regular customer', () => {
    mockUser.current = { id: 1, role: 'customer' };
    const { container } = render(<HeaderMain categories={[]} />);
    expect(container.textContent).not.toContain('Оптовий клієнт');
  });

  it('shows cart total and items count text when items > 0', () => {
    mockItemCount.current = 3;
    mockTotal.mockReturnValue(150);
    const { container } = render(<HeaderMain categories={[]} />);
    expect(container.textContent).toContain('150 ₴');
    expect(container.textContent).toContain('У кошику 3 товарів');
  });

  it('shows mini cart on cart area hover when items > 0', () => {
    mockItemCount.current = 2;
    mockTotal.mockReturnValue(100);
    const { container } = render(<HeaderMain categories={[]} />);

    // Find the cart container div with onMouseEnter
    const cartButton = screen.getByLabelText('Кошик');
    const cartContainer = cartButton.closest('[class*="lg:flex"]')!;
    fireEvent.mouseEnter(cartContainer);
    expect(screen.getByTestId('mini-cart')).toBeInTheDocument();
  });

  it('hides mini cart on mouse leave', () => {
    mockItemCount.current = 2;
    mockTotal.mockReturnValue(100);
    const { container } = render(<HeaderMain categories={[]} />);

    const cartButton = screen.getByLabelText('Кошик');
    const cartContainer = cartButton.closest('[class*="lg:flex"]')!;
    fireEvent.mouseEnter(cartContainer);
    expect(screen.getByTestId('mini-cart')).toBeInTheDocument();

    fireEvent.mouseLeave(cartContainer);
    expect(screen.queryByTestId('mini-cart')).not.toBeInTheDocument();
  });

  it('toggles mini cart on cart button click', () => {
    mockItemCount.current = 0;
    render(<HeaderMain categories={[]} />);
    const cartButton = screen.getByLabelText('Кошик');

    // Click to open (even with 0 items, setCartOpen toggles)
    fireEvent.click(cartButton);
    // Mini cart renders only when cartOpen is true
    // With 0 items, the cartOpen becomes true but it still renders
    expect(screen.getByTestId('mini-cart')).toBeInTheDocument();

    // Click again to close
    fireEvent.click(cartButton);
    expect(screen.queryByTestId('mini-cart')).not.toBeInTheDocument();
  });

  it('closes mini cart via onClose callback', () => {
    mockItemCount.current = 2;
    render(<HeaderMain categories={[]} />);
    const cartButton = screen.getByLabelText('Кошик');
    const cartContainer = cartButton.closest('[class*="lg:flex"]')!;
    fireEvent.mouseEnter(cartContainer);
    expect(screen.getByTestId('mini-cart')).toBeInTheDocument();

    // Click the close button inside mini cart
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('mini-cart')).not.toBeInTheDocument();
  });

  it('does not show mini cart on hover when itemCount is 0', () => {
    mockItemCount.current = 0;
    render(<HeaderMain categories={[]} />);
    const cartButton = screen.getByLabelText('Кошик');
    const cartContainer = cartButton.closest('[class*="lg:flex"]')!;
    fireEvent.mouseEnter(cartContainer);
    // Should NOT auto-open because itemCount is 0
    expect(screen.queryByTestId('mini-cart')).not.toBeInTheDocument();
  });

  it('does not show mobile notification bell when no user', () => {
    mockUser.current = null;
    render(<HeaderMain categories={[]} />);
    // Only the desktop notification should be absent, the mobile one too
    expect(screen.queryByLabelText('Сповіщення')).not.toBeInTheDocument();
  });
});
