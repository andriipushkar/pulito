// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import StockAnalytics from './StockAnalytics';

const mockData = {
  criticalStock: [{ id: 1, code: 'P1', name: 'Product', quantity: 2, avgDailySales: 1, daysUntilOut: 2 }],
  deadStock: [{ id: 2, code: 'P2', name: 'Dead Product', quantity: 100, lastSoldAt: null, daysSinceLastSale: null }],
  turnoverRates: [{ id: 3, code: 'P3', name: 'Fast Product', quantity: 50, soldLast30: 30, turnoverRate: 0.6 }],
  summary: { totalProducts: 100, criticalCount: 5, deadStockCount: 10, avgTurnover: 0.8 },
};

describe('StockAnalytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<StockAnalytics days={30} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders stock data', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<StockAnalytics days={30} />);
    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });

  it('returns null on no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<StockAnalytics days={30} />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('switches to dead stock view and shows dead stock items', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });

    const deadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Dead Stock')!;
    deadBtn.click();

    await waitFor(() => {
      expect(container.textContent).toContain('Dead Product');
      expect(container.textContent).toContain('P2');
      expect(container.textContent).toContain('Ніколи');
    });
  });

  it('switches to turnover view and shows turnover items', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });

    const turnoverBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Оборотність')!;
    turnoverBtn.click();

    await waitFor(() => {
      expect(container.textContent).toContain('Fast Product');
      expect(container.textContent).toContain('P3');
      expect(container.textContent).toContain('0.6');
    });
  });

  it('renders critical stock view by default with correct columns', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.textContent).toContain('Продаж/день');
      expect(container.textContent).toContain('Днів до 0');
      expect(container.textContent).toContain('P1');
    });
  });

  it('renders summary cards', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.textContent).toContain('100');
      expect(container.textContent).toContain('5');
      expect(container.textContent).toContain('10');
      expect(container.textContent).toContain('0.8');
    });
  });

  it('shows daysUntilOut with color coding for critical items', async () => {
    const dataWithVariousUrgency = {
      ...mockData,
      criticalStock: [
        { id: 1, code: 'P1', name: 'Urgent', quantity: 2, avgDailySales: 1, daysUntilOut: 2 },
        { id: 4, code: 'P4', name: 'Medium', quantity: 10, avgDailySales: 1, daysUntilOut: 5 },
        { id: 5, code: 'P5', name: 'Low', quantity: 20, avgDailySales: 1, daysUntilOut: 10 },
        { id: 6, code: 'P6', name: 'NullDays', quantity: 1, avgDailySales: 0, daysUntilOut: null },
      ],
    };
    mockGet.mockResolvedValue({ success: true, data: dataWithVariousUrgency });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.textContent).toContain('2 дн.');
      expect(container.textContent).toContain('5 дн.');
      expect(container.textContent).toContain('10 дн.');
      expect(container.textContent).toContain('— дн.');
    });
  });

  it('shows dead stock with daysSinceLastSale value', async () => {
    const dataWithSoldDead = {
      ...mockData,
      deadStock: [
        { id: 7, code: 'P7', name: 'Old Product', quantity: 50, lastSoldAt: '2023-06-01', daysSinceLastSale: 90 },
      ],
    };
    mockGet.mockResolvedValue({ success: true, data: dataWithSoldDead });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });

    const deadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Dead Stock')!;
    deadBtn.click();

    await waitFor(() => {
      expect(container.textContent).toContain('90');
      expect(container.textContent).toContain('Old Product');
    });
  });

  it('shows turnover rate with correct color for high turnover', async () => {
    const dataWithHighTurnover = {
      ...mockData,
      turnoverRates: [
        { id: 8, code: 'P8', name: 'Hot Product', quantity: 10, soldLast30: 100, turnoverRate: 1.5 },
        { id: 9, code: 'P9', name: 'Slow Product', quantity: 10, soldLast30: 2, turnoverRate: 0.2 },
      ],
    };
    mockGet.mockResolvedValue({ success: true, data: dataWithHighTurnover });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });

    const turnoverBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Оборотність')!;
    turnoverBtn.click();

    await waitFor(() => {
      expect(container.textContent).toContain('1.5');
      expect(container.textContent).toContain('0.2');
    });
  });

  it('highlights selected view button', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<StockAnalytics days={30} />);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });

    const criticalBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Критичні залишки')!;
    expect(criticalBtn.className).toContain('bg-[var(--color-primary)]');

    const deadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Dead Stock')!;
    expect(deadBtn.className).toContain('bg-[var(--color-bg-secondary)]');
  });
});
