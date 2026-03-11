// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('next/image', () => ({
  default: ({ fill, ...props }: any) => <img data-fill={fill ? 'true' : undefined} {...props} />,
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));
vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick, isLoading, disabled, variant, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || isLoading} data-variant={variant} {...props}>
      {isLoading ? 'Loading...' : children}
    </button>
  ),
}));
vi.mock('@/components/ui/Input', () => ({
  default: ({ label, value, onChange, placeholder, ...props }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input value={value} onChange={onChange} placeholder={placeholder} {...props} />
    </div>
  ),
}));

import OrderItemsEditor from './OrderItemsEditor';

function makeProps() {
  return {
    orderId: 100,
    items: [
      {
        id: 1,
        productId: 10,
        productCode: 'ABC-001',
        productName: 'Порошок для прання',
        priceAtOrder: '150.00',
        quantity: 2,
        imagePath: '/img/product1.jpg',
      },
      {
        id: 2,
        productId: 20,
        productCode: 'DEF-002',
        productName: 'Засіб для миття',
        priceAtOrder: '75.50',
        quantity: 1,
        imagePath: null,
      },
    ] as any,
    onSaved: vi.fn(),
    onClose: vi.fn(),
  };
}

/** Helper to trigger debounced search and flush microtasks with fake timers */
async function triggerSearch(container: HTMLElement, query: string) {
  const searchInput = container.querySelector('input[placeholder*="Пошук"]') as HTMLInputElement;
  fireEvent.change(searchInput, { target: { value: query } });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  // Flush microtask queue for async operations inside setTimeout
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('OrderItemsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders all items and totals correctly', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    expect(container.textContent).toContain('Порошок для прання');
    expect(container.textContent).toContain('Засіб для миття');
    expect(container.textContent).toContain('ABC-001');
    expect(container.textContent).toContain('DEF-002');
    expect(container.textContent).toContain('375.50 ₴');
    expect(container.textContent).toContain('Товарів: 3');
  });

  it('renders cancel and save buttons', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    expect(container.textContent).toContain('Скасувати');
    expect(container.textContent).toContain('Зберегти');
  });

  it('calls onClose when cancel button is clicked', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Скасувати');
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn!);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('increments item quantity when plus is clicked', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const plusBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === '+');
    fireEvent.click(plusBtns[0]);
    expect(container.textContent).toContain('525.50 ₴');
  });

  it('decrements item quantity when minus is clicked', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const minusBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === '-');
    fireEvent.click(minusBtns[0]);
    expect(container.textContent).toContain('225.50 ₴');
  });

  it('does not decrement quantity below 1', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const minusBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === '-');
    fireEvent.click(minusBtns[1]);
    expect(container.textContent).toContain('375.50 ₴');
  });

  it('marks item as removed and updates totals', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const removeBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === 'Видалити');
    fireEvent.click(removeBtns[0]);
    expect(container.textContent).toContain('Повернути');
    expect(container.textContent).toContain('Товарів: 1');
  });

  it('restores removed item when restore is clicked', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const removeBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === 'Видалити');
    fireEvent.click(removeBtns[0]);
    const restoreBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Повернути');
    fireEvent.click(restoreBtn!);
    expect(container.textContent).toContain('Товарів: 3');
  });

  it('renders search input for adding products', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const searchInput = container.querySelector('input[placeholder*="Пошук"]');
    expect(searchInput).toBeTruthy();
  });

  it('calls save API and onSaved callback on success', async () => {
    vi.useRealTimers();
    const mockOrder = { id: 100, items: [] };
    mockPut.mockResolvedValue({ success: true, data: mockOrder });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Зберегти');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/v1/admin/orders/100/items', {
        items: expect.any(Array),
      });
    });
    await waitFor(() => {
      expect(props.onSaved).toHaveBeenCalledWith(mockOrder);
    });
  });

  it('shows error on save failure', async () => {
    vi.useRealTimers();
    mockPut.mockResolvedValue({ success: false, error: 'Помилка збереження' });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Зберегти');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('Помилка збереження');
    });
  });

  it('shows network error on save exception', async () => {
    vi.useRealTimers();
    mockPut.mockRejectedValue(new Error('Network'));
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Зберегти');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('Помилка мережі');
    });
  });

  it('renders product images and photo placeholders', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    expect(container.querySelectorAll('img[src="/img/product1.jpg"]').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Фото');
  });

  it('handles direct quantity input change', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const qtyInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(qtyInputs[0], { target: { value: '5' } });
    expect(container.textContent).toContain('825.50 ₴');
  });

  it('ignores zero and non-numeric quantity input', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const qtyInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(qtyInputs[0], { target: { value: '0' } });
    expect(container.textContent).toContain('375.50 ₴');
    fireEvent.change(qtyInputs[0], { target: { value: 'abc' } });
    expect(container.textContent).toContain('375.50 ₴');
  });

  it('sends removed items with remove flag in payload', async () => {
    vi.useRealTimers();
    mockPut.mockResolvedValue({ success: true, data: { id: 100, items: [] } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);
    const removeBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === 'Видалити');
    fireEvent.click(removeBtns[1]);
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Зберегти');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalled();
      const items = mockPut.mock.calls[0][1].items;
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveProperty('itemId', 1);
      expect(items[1]).toEqual({ itemId: 2, quantity: 0, remove: true });
    });
  });

  it('searches products via API with debounce and shows dropdown results', async () => {
    const searchProducts = [
      { id: 30, name: 'Мило рідке', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: '/img/soap.jpg', images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    expect(mockGet).toHaveBeenCalledWith('/api/v1/products/search?q=%D0%9C%D0%B8%D0%BB%D0%BE');
    expect(container.textContent).toContain('Мило рідке');
    expect(container.textContent).toContain('MR-001');
  });

  it('adds a product from search results and clears error (line 144)', async () => {
    const searchProducts = [
      { id: 30, name: 'Мило рідке', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: '/img/soap.jpg', images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    expect(container.textContent).toContain('Мило рідке');

    // Click to add the product
    const dropdownBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Мило рідке'));
    fireEvent.click(dropdownBtn!);

    // Product should be added to the list with (новий) marker
    expect(container.textContent).toContain('(новий)');
    expect(container.textContent).toContain('Мило рідке');
  });

  it('shows duplicate error when adding existing product', async () => {
    const searchProducts = [
      { id: 10, name: 'Порошок для прання', code: 'ABC-001', priceRetail: 150, priceWholesale: null, quantity: 5, imagePath: '/img/product1.jpg', images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Порошок');

    const dropdownBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('ABC-001') && b.closest('.absolute')
    );
    fireEvent.click(dropdownBtn!);

    expect(container.textContent).toContain('вже додано');
  });

  it('restores previously removed product when adding from search', async () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    // Remove the first item
    const removeBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === 'Видалити');
    fireEvent.click(removeBtns[0]);
    expect(container.textContent).toContain('Повернути');

    // Now search and add the same product
    const searchProducts = [
      { id: 10, name: 'Порошок для прання', code: 'ABC-001', priceRetail: 150, priceWholesale: null, quantity: 5, imagePath: '/img/product1.jpg', images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });

    await triggerSearch(container, 'Порошок');

    const dropdownBtn = container.querySelector('.absolute button') as HTMLElement;
    fireEvent.click(dropdownBtn);

    // Should be restored (no more "Повернути")
    expect(container.textContent).not.toContain('Повернути');
    expect(container.textContent).toContain('Товарів: 3');
  });

  it('sends new items with productId in save payload (line 192)', async () => {
    vi.useRealTimers();
    const searchProducts = [
      { id: 30, name: 'Мило рідке', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: null, images: [{ pathThumbnail: '/thumb.jpg' }] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    mockPut.mockResolvedValue({ success: true, data: { id: 100, items: [] } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    const searchInput = container.querySelector('input[placeholder*="Пошук"]') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Мило' } });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Мило рідке');
    });

    const dropdownBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Мило рідке'));
    fireEvent.click(dropdownBtn!);

    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Зберегти');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalled();
      const items = mockPut.mock.calls[0][1].items;
      expect(items).toHaveLength(3);
      expect(items[2]).toEqual({ productId: 30, quantity: 1 });
    });
  });

  it('removes new items entirely when delete is clicked', async () => {
    const searchProducts = [
      { id: 30, name: 'Мило рідке', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: null, images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    expect(container.textContent).toContain('Мило рідке');

    const dropdownBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Мило рідке'));
    fireEvent.click(dropdownBtn!);

    expect(container.textContent).toContain('(новий)');

    // Remove the new item
    const removeBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent === 'Видалити');
    fireEvent.click(removeBtns[removeBtns.length - 1]);

    expect(container.textContent).not.toContain('Мило рідке');
  });

  it('clears search results when query is too short', () => {
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    const searchInput = container.querySelector('input[placeholder*="Пошук"]') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'M' } });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('closes dropdown on outside click', async () => {
    const searchProducts = [
      { id: 30, name: 'Мило рідке', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: '/img/soap.jpg', images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    expect(container.textContent).toContain('Мило рідке');

    // Click outside
    fireEvent.mouseDown(document.body);

    const dropdownDiv = container.querySelector('.absolute.z-10');
    expect(dropdownDiv).toBeNull();
  });

  it('shows empty search results message', async () => {
    mockGet.mockResolvedValue({ success: true, data: { products: [] } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'nonexistent');

    expect(container.textContent).toContain('Товарів не знайдено');
  });

  it('shows searching indicator during API call', async () => {
    let resolveSearch: any;
    mockGet.mockReturnValue(new Promise((resolve) => { resolveSearch = resolve; }));
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    const searchInput = container.querySelector('input[placeholder*="Пошук"]') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Мило' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(container.textContent).toContain('Пошук...');

    await act(async () => {
      resolveSearch({ success: true, data: { products: [] } });
    });
  });

  it('handles search API error gracefully', async () => {
    mockGet.mockRejectedValue(new Error('API Error'));
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    // Should not crash - search indicator should be gone
    expect(container.textContent).not.toContain('Пошук...');
  });

  it('uses image from product.images fallback when imagePath is null', async () => {
    const searchProducts = [
      { id: 30, name: 'Мило', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: null, images: [{ pathThumbnail: '/thumb.jpg' }] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    expect(container.textContent).toContain('Мило');

    const dropdownBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('MR-001'));
    fireEvent.click(dropdownBtn!);

    const imgs = container.querySelectorAll('img[src="/thumb.jpg"]');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it('shows search result product with image in dropdown', async () => {
    const searchProducts = [
      { id: 30, name: 'Мило рідке', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: '/img/soap.jpg', images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    const img = container.querySelector('.absolute img[src="/img/soap.jpg"]');
    expect(img).toBeTruthy();
  });

  it('shows search result product without image (Фото placeholder) in dropdown', async () => {
    const searchProducts = [
      { id: 30, name: 'Мило рідке', code: 'MR-001', priceRetail: 50, priceWholesale: null, quantity: 10, imagePath: null, images: [] },
    ];
    mockGet.mockResolvedValue({ success: true, data: { products: searchProducts } });
    const props = makeProps();
    const { container } = render(<OrderItemsEditor {...props} />);

    await triggerSearch(container, 'Мило');

    const dropdown = container.querySelector('.absolute.z-10');
    expect(dropdown).toBeTruthy();
    expect(dropdown!.textContent).toContain('Фото');
  });
});
