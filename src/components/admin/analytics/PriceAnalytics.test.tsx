// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import PriceAnalytics from './PriceAnalytics';

const mockData = {
  changes: [
    {
      productId: 1, product: { name: 'Product A', code: 'PA1' },
      priceRetailOld: 100, priceRetailNew: 120, changePercent: 20, changedAt: '2024-01-15',
    },
    {
      productId: 2, product: { name: 'Product B', code: 'PB1' },
      priceRetailOld: 200, priceRetailNew: 150, changePercent: -25, changedAt: '2024-02-10',
    },
  ],
  promoImpact: [
    {
      productId: 3, productName: 'Promo Product', productCode: 'PP1',
      avgSalesBefore: 5, avgSalesAfter: 10, salesLift: 100,
      revenueBefore: 500, revenueAfter: 800,
    },
    {
      productId: 4, productName: 'Neg Promo', productCode: 'PP2',
      avgSalesBefore: 8, avgSalesAfter: 6, salesLift: -25,
      revenueBefore: 800, revenueAfter: 600,
    },
    {
      productId: 5, productName: 'Zero Promo', productCode: 'PP3',
      avgSalesBefore: 5, avgSalesAfter: 5, salesLift: 0,
      revenueBefore: 500, revenueAfter: 500,
    },
  ],
  summary: { totalChanges: 2, priceIncreases: 1, priceDecreases: 1, avgChangePercent: -2.5 },
};

describe('PriceAnalytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<PriceAnalytics days={30} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('-2.5%');
    });
  });

  it('renders changes table by default', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.textContent).toContain('PA1');
      expect(container.textContent).toContain('Product A');
      expect(container.textContent).toContain('100.00 ₴');
      expect(container.textContent).toContain('120.00 ₴');
      expect(container.textContent).toContain('+20%');
      expect(container.textContent).toContain('-25%');
    });
  });

  it('renders positive change with green styling', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      const spans = container.querySelectorAll('span.rounded');
      const positiveSpan = Array.from(spans).find(s => s.textContent?.includes('+20%'));
      const negativeSpan = Array.from(spans).find(s => s.textContent?.includes('-25%'));
      expect(positiveSpan?.className).toContain('bg-green-100');
      expect(negativeSpan?.className).toContain('bg-red-100');
    });
  });

  it('returns null on no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('formats dates correctly', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('15.01.2024');
    });
  });

  it('passes correct days parameter to API', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    render(<PriceAnalytics days={14} />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/analytics/price?days=14');
    });
  });

  it('switches to promo view and renders promo impact table (line 75, 126-138)', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('PA1');
    });

    // Click promo tab
    const promoBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Вплив знижок'));
    fireEvent.click(promoBtn!);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
      // Headers
      expect(container.textContent).toContain('Код');
      expect(container.textContent).toContain('Назва');
      expect(container.textContent).toContain('Продаж до');
      expect(container.textContent).toContain('Продаж після');
      expect(container.textContent).toContain('Зміна продажів');
      expect(container.textContent).toContain('Виручка до');
      expect(container.textContent).toContain('Виручка після');
      // Data
      expect(container.textContent).toContain('PP1');
      expect(container.textContent).toContain('Promo Product');
      expect(container.textContent).toContain('5/день');
      expect(container.textContent).toContain('10/день');
      expect(container.textContent).toContain('+100%');
      expect(container.textContent).toContain('500 ₴');
      expect(container.textContent).toContain('800 ₴');
    });
  });

  it('renders promo impact with negative and zero sales lift styling', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('PA1');
    });

    const promoBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Вплив знижок'));
    fireEvent.click(promoBtn!);

    await waitFor(() => {
      const spans = container.querySelectorAll('span.rounded');
      // Positive lift: green
      const positiveSpan = Array.from(spans).find(s => s.textContent === '+100%');
      expect(positiveSpan?.className).toContain('bg-green-100');
      // Negative lift: red
      const negativeSpan = Array.from(spans).find(s => s.textContent === '-25%');
      expect(negativeSpan?.className).toContain('bg-red-100');
      // Zero lift: gray
      const zeroSpan = Array.from(spans).find(s => s.textContent === '0%');
      expect(zeroSpan?.className).toContain('bg-gray-100');
    });
  });

  it('renders empty promo impact message when no promo data', async () => {
    const emptyPromoData = {
      ...mockData,
      promoImpact: [],
    };
    mockGet.mockResolvedValue({ success: true, data: emptyPromoData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('PA1');
    });

    const promoBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Вплив знижок'));
    fireEvent.click(promoBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('Немає акційних товарів');
    });
  });

  it('switches back from promo to changes view', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<PriceAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('PA1');
    });

    // Switch to promo
    const promoBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Вплив знижок'));
    fireEvent.click(promoBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('Promo Product');
    });

    // Switch back to changes
    const changesBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Історія змін'));
    fireEvent.click(changesBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('PA1');
      expect(container.textContent).toContain('Product A');
    });
  });
});
