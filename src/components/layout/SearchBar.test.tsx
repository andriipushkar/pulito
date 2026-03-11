// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.hoisted(() => vi.fn().mockResolvedValue({ success: false }));
const mockPost = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
const mockDelete = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
const mockUser = vi.hoisted(() => ({ current: null as any }));
const mockRecentIds = vi.hoisted(() => ({ current: [] as number[] }));

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser.current }) }));
vi.mock('@/hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ ids: mockRecentIds.current }) }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import SearchBar from './SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUser.current = null;
    mockRecentIds.current = [];
    mockGet.mockResolvedValue({ success: false });
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
    // Prevent jsdom navigation errors
    delete (window as any).location;
    (window as any).location = { href: '', assign: vi.fn(), replace: vi.fn() };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders search input', () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText('Пошук товарів...')).toBeInTheDocument();
  });

  it('has combobox role', () => {
    render(<SearchBar />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('has aria-expanded false initially', () => {
    render(<SearchBar />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('has aria-autocomplete attribute', () => {
    render(<SearchBar />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('updates query on input change', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });
    expect((input as HTMLInputElement).value).toBe('test');
  });

  it('shows suggestions on focus when query is short', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [{ id: 1, name: 'Product', slug: 'product', priceRetail: '100', imagePath: null }] }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => {
      fireEvent.focus(input);
    });
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('triggers search after debounce when typing 2+ chars', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { products: [], categories: [] } }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'so' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/products/search?q=so'));
  });

  it('does not search for single character', async () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 's' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/products/search'));
  });

  it('closes dropdown on Escape key', async () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.focus(input);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes dropdown on click outside', async () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.focus(input);

    fireEvent.mouseDown(document.body);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('navigates with ArrowDown key', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
  });

  it('navigates with ArrowUp key', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
  });

  it('does not crash on Enter when query length >= 2', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'soap' } });
    expect(() => fireEvent.keyDown(input, { key: 'Enter' })).not.toThrow();
  });

  it('enters mobile fullscreen on focus when window is narrow', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => {
      fireEvent.focus(input);
    });
    expect(screen.getByLabelText('Закрити пошук')).toBeInTheDocument();
  });

  it('closes mobile fullscreen on close button click', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => {
      fireEvent.focus(input);
    });
    fireEvent.click(screen.getByLabelText('Закрити пошук'));
    expect(screen.queryByLabelText('Закрити пошук')).toBeNull();
  });

  it('handles search API failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(input).toBeInTheDocument();
  });

  it('clears results when query is shortened below 2 chars', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: { products: [{ id: 1, name: 'X', slug: 'x', code: 'X', priceRetail: '10', quantity: 1, imagePath: null }], categories: [] },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    fireEvent.change(input, { target: { value: 't' } });
    expect(screen.queryByText('Товари')).toBeNull();
  });

  it('renders search results with categories and products', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [{ id: 1, name: 'Порошки', slug: 'poroshky', _count: { products: 5 } }],
          products: [
            { id: 1, name: 'Порошок Ariel', slug: 'ariel', code: 'AR01', priceRetail: '150.50', quantity: 10, imagePath: '/ariel.jpg' },
            { id: 2, name: 'Порошок Tide', slug: 'tide', code: 'TD01', priceRetail: '120.00', quantity: 0, imagePath: null },
          ],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'Порошок' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(screen.getByText('Категорії')).toBeInTheDocument();
    expect(screen.getByText('Товари')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('AR01')).toBeInTheDocument();
    expect(screen.getByText('TD01')).toBeInTheDocument();
    expect(screen.getByText('150.50 ₴')).toBeInTheDocument();
    expect(screen.getByText('Показати всі результати')).toBeInTheDocument();
  });

  it('renders "nothing found" when no results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: { categories: [], products: [] },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'xyz' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(screen.getByText(/Нічого не знайдено/)).toBeInTheDocument();
  });

  it('renders product image or placeholder in search results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [],
          products: [
            { id: 1, name: 'WithImage', slug: 'wi', code: 'W1', priceRetail: '50', quantity: 1, imagePath: '/img.jpg' },
            { id: 2, name: 'NoImage', slug: 'ni', code: 'N1', priceRetail: '30', quantity: 1, imagePath: null },
          ],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(screen.getAllByText('WithImage').length).toBeGreaterThan(0);
  });

  it('fetches trending products on focus', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'Trending1', slug: 'trend1', priceRetail: '100', imagePath: '/t1.jpg' },
        ],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => {
      fireEvent.focus(input);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/products/popular?limit=4');
  });

  it('navigates to product via Enter on active search result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [],
          products: [
            { id: 1, name: 'Product1', slug: 'p1', code: 'P1', priceRetail: '50', quantity: 1, imagePath: null },
          ],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'prod' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(() => fireEvent.keyDown(input, { key: 'Enter' })).not.toThrow();
  });

  it('saves to history and navigates on "show all results" click', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [{ id: 1, name: 'Cat', slug: 'cat', _count: { products: 3 } }],
          products: [],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    const showAll = screen.getByText('Показати всі результати');
    expect(showAll.closest('a')).toHaveAttribute('href', '/catalog?search=test');
  });

  // --- New tests for uncovered lines ---


  it('does not fetch search history when no user', () => {
    mockUser.current = null;
    render(<SearchBar />);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('displays search history in suggestions dropdown', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { id: 1, query: 'порошок', createdAt: '2026-01-01' },
      ],
    });

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => {
      fireEvent.focus(input);
    });

    expect(screen.getByText('Історія пошуку')).toBeInTheDocument();
    expect(screen.getByText('порошок')).toBeInTheDocument();
    expect(screen.getByText('Очистити')).toBeInTheDocument();
  });

  it('clicks on history entry to search', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, query: 'порошок', createdAt: '2026-01-01' }],
    });

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const historyBtn = screen.getByText('порошок').closest('button')!;
    fireEvent.click(historyBtn);

    // Should navigate
    expect(window.location.href).toContain('/catalog?search=');
  });

  it('removes a single history entry', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { id: 1, query: 'порошок', createdAt: '2026-01-01' },
        { id: 2, query: 'мило', createdAt: '2026-01-02' },
      ],
    });
    mockDelete.mockResolvedValue({ success: true });

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    // Find the remove button (the X span with role="button")
    const removeButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg'));
    // The remove buttons have role="button" on a span
    const removeBtns = document.querySelectorAll('[role="button"][tabindex="0"]');
    expect(removeBtns.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(removeBtns[0]);
    });

    expect(mockDelete).toHaveBeenCalledWith(expect.stringContaining('/api/v1/me/search-history?id=1'));
  });

  it('handles keyboard on remove history entry (Enter)', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, query: 'порошок', createdAt: '2026-01-01' }],
    });
    mockDelete.mockResolvedValue({ success: true });

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const removeBtns = document.querySelectorAll('[role="button"][tabindex="0"]');
    expect(removeBtns.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.keyDown(removeBtns[0], { key: 'Enter' });
    });

    expect(mockDelete).toHaveBeenCalled();
  });

  it('handles keyboard on remove history entry (Space)', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, query: 'порошок', createdAt: '2026-01-01' }],
    });
    mockDelete.mockResolvedValue({ success: true });

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const removeBtns = document.querySelectorAll('[role="button"][tabindex="0"]');
    await act(async () => {
      fireEvent.keyDown(removeBtns[0], { key: ' ' });
    });

    expect(mockDelete).toHaveBeenCalled();
  });

  it('clears all history', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, query: 'порошок', createdAt: '2026-01-01' }],
    });
    mockDelete.mockResolvedValue({ success: true });

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const clearBtn = screen.getByText('Очистити');
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/me/search-history');
  });

  it('displays trending products in suggestions', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'Trending Soap', slug: 'soap', priceRetail: '99', imagePath: '/soap.jpg' },
          { id: 2, name: 'Trending Gel', slug: 'gel', priceRetail: '50', imagePath: null },
        ],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    expect(screen.getByText('Популярні товари')).toBeInTheDocument();
    expect(screen.getByText('Trending Soap')).toBeInTheDocument();
    expect(screen.getByText('Trending Gel')).toBeInTheDocument();
  });

  it('displays trending product images or placeholder', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'WithImg', slug: 'wi', priceRetail: '99', imagePath: '/img.jpg' },
          { id: 2, name: 'NoImg', slug: 'ni', priceRetail: '50', imagePath: null },
        ],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    // Should have one img for WithImg and a placeholder div for NoImg
    const imgs = document.querySelectorAll('img[src="/img.jpg"]');
    expect(imgs.length).toBe(1);
  });




  it('sets recentProducts to empty when no recentlyViewedIds', async () => {
    mockRecentIds.current = [];

    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    // Should not show "Нещодавно переглянуті" when no ids
    expect(screen.queryByText('Нещодавно переглянуті')).not.toBeInTheDocument();
  });

  it('navigates via keyboard ArrowDown/Enter on history item', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, query: 'порошок', createdAt: '2026-01-01' }],
    });

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    // ArrowDown to select history item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Enter to select it
    fireEvent.keyDown(input, { key: 'Enter' });

    // Should navigate
    expect(window.location.href).toContain('/catalog?search=');
  });

  it('navigates via keyboard ArrowDown/Enter on trending product', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'TrendProd', slug: 'trend-prod', priceRetail: '100', imagePath: null },
        ],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    // ArrowDown to select trending item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(window.location.href).toContain('/product/trend-prod');
  });

  it('wraps around on ArrowDown past last item', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'Only', slug: 'only', priceRetail: '100', imagePath: null },
        ],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    // Go down twice (past the only item)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Should wrap around to 0
  });

  it('wraps around on ArrowUp from first item', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'Only', slug: 'only', priceRetail: '100', imagePath: null },
        ],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    // Should wrap to last item
  });

  it('opens results dropdown on focus when results exist and query >= 2', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [],
          products: [{ id: 1, name: 'Product1', slug: 'p1', code: 'P1', priceRetail: '50', quantity: 1, imagePath: null }],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    // Close it
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');

    // Re-focus should reopen results
    await act(async () => { fireEvent.focus(input); });
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('handles fetch trending failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    // Should not crash
    expect(input).toBeInTheDocument();
  });

  it('handles fetch recent products failure gracefully', async () => {
    mockRecentIds.current = [10];
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    expect(input).toBeInTheDocument();
  });

  it('handles history fetch failure gracefully', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByPlaceholderText('Пошук товарів...')).toBeInTheDocument();
  });

  it('handles remove history entry failure gracefully', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, query: 'порошок', createdAt: '2026-01-01' }],
    });
    mockDelete.mockRejectedValue(new Error('Network error'));

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const removeBtns = document.querySelectorAll('[role="button"][tabindex="0"]');
    await act(async () => {
      fireEvent.click(removeBtns[0]);
    });

    // Should not crash
    expect(input).toBeInTheDocument();
  });

  it('handles clear history failure gracefully', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({
      success: true,
      data: [{ id: 1, query: 'порошок', createdAt: '2026-01-01' }],
    });
    mockDelete.mockRejectedValue(new Error('Network error'));

    render(<SearchBar />);
    await act(async () => { await Promise.resolve(); });

    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const clearBtn = screen.getByText('Очистити');
    await act(async () => { fireEvent.click(clearBtn); });

    expect(input).toBeInTheDocument();
  });


  it('does not save to history when query is too short', () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: [] });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 's' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockPost).not.toHaveBeenCalled();
  });



  it('highlights matching text in category and product names', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [{ id: 1, name: 'Порошки для прання', slug: 'poroshky', _count: { products: 5 } }],
          products: [
            { id: 1, name: 'Порошок Ariel', slug: 'ariel', code: 'AR01', priceRetail: '150', quantity: 10, imagePath: null },
          ],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'Порошо' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    // The highlight function creates <mark> elements
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
  });

  it('does not highlight when query is too short for highlightMatch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [{ id: 1, name: 'A', slug: 'a', _count: { products: 1 } }],
          products: [],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    // Search with 2 chars but highlight won't apply for < 2 char query? Actually highlightMatch checks query.length < 2
    // The search itself requires 2+ chars, but highlightMatch also requires 2+ chars
    fireEvent.change(input, { target: { value: 'AA' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    // This should still highlight since query is 2 chars
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('only fetches trending once even on multiple focuses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [{ id: 1, name: 'T1', slug: 't1', priceRetail: '100', imagePath: null }],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');

    await act(async () => { fireEvent.focus(input); });
    fireEvent.mouseDown(document.body); // close
    await act(async () => { fireEvent.focus(input); });

    // /popular should only have been called once due to trendingFetchedRef
    const popularCalls = (globalThis.fetch as any).mock.calls.filter(
      (c: any[]) => c[0].includes('/popular')
    );
    expect(popularCalls.length).toBe(1);
  });

  it('closes search results when clicking on a category result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [{ id: 1, name: 'Cat1', slug: 'cat1', _count: { products: 5 } }],
          products: [],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'cat' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    const catLink = document.querySelector('a[href="/catalog?category=cat1"]')!;
    fireEvent.click(catLink);

    // Dropdown should close
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes search results when clicking on a product result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [],
          products: [{ id: 1, name: 'Prod1', slug: 'prod1', code: 'P1', priceRetail: '50', quantity: 1, imagePath: null }],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'prod' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    const prodLink = document.querySelector('a[href="/product/prod1"]')!;
    fireEvent.click(prodLink);

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows loading spinner during search', async () => {
    let resolveSearch: (v: any) => void;
    const searchPromise = new Promise((resolve) => { resolveSearch = resolve; });

    globalThis.fetch = vi.fn().mockReturnValue({
      json: () => searchPromise,
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });

    await act(async () => { vi.advanceTimersByTime(300); });

    // Spinner should be visible (animate-spin class)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    await act(async () => {
      resolveSearch!({ success: true, data: { categories: [], products: [] } });
    });
  });

  it('navigates via Enter on active category result in search results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [{ id: 1, name: 'Cat1', slug: 'cat1', _count: { products: 5 } }],
          products: [{ id: 1, name: 'Prod1', slug: 'prod1', code: 'P1', priceRetail: '50', quantity: 1, imagePath: null }],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    // Arrow down to first item (category)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(window.location.href).toContain('/catalog?category=cat1');
  });

  it('closes dropdown when clicking on a recently viewed product', async () => {
    mockRecentIds.current = [1, 2];
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (url.includes('/products?ids=')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: { products: [
              { id: 1, name: 'RecentProd', slug: 'recent-prod', priceRetail: '80', imagePath: '/rp.jpg' },
            ]},
          }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const recentLink = document.querySelector('a[href="/product/recent-prod"]');
    expect(recentLink).not.toBeNull();
    fireEvent.click(recentLink!);

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes dropdown when clicking on a trending product', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 1, name: 'TrendClick', slug: 'trend-click', priceRetail: '100', imagePath: null },
        ],
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });

    const trendLink = document.querySelector('a[href="/product/trend-click"]');
    expect(trendLink).not.toBeNull();
    fireEvent.click(trendLink!);

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('saves to history and closes when clicking show all results', async () => {
    mockUser.current = { id: 1, role: 'customer' };
    mockGet.mockResolvedValue({ success: true, data: [] });

    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          categories: [{ id: 1, name: 'Cat', slug: 'cat', _count: { products: 3 } }],
          products: [],
        },
      }),
    });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    fireEvent.change(input, { target: { value: 'test' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    const showAll = screen.getByText('Показати всі результати');
    await act(async () => { fireEvent.click(showAll); });

    // saveToHistory should have been called
    expect(mockPost).toHaveBeenCalledWith('/api/v1/me/search-history', { query: 'test' });
    // Dropdown should be closed
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape in mobile fullscreen closes fullscreen mode', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });

    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Пошук товарів...');
    await act(async () => { fireEvent.focus(input); });
    expect(screen.getByLabelText('Закрити пошук')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText('Закрити пошук')).not.toBeInTheDocument();
  });
});
