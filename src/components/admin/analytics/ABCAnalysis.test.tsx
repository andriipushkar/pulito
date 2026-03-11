// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...args: any[]) => mockGet(...args) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import ABCAnalysis from './ABCAnalysis';

const mockData = {
  products: [
    { productId: 1, productCode: 'P1', productName: 'Product 1', revenue: 1000, quantity: 10, orders: 5, revenuePercent: 80, cumulativePercent: 80, category: 'A' as const },
  ],
  summary: { A: 5, B: 10, C: 20, totalRevenue: 5000, totalProducts: 35 },
};

describe('ABCAnalysis', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<ABCAnalysis />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders data after loading', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ABCAnalysis days={30} />);
    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });

  it('returns null when no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<ABCAnalysis />);
    await waitFor(() => {
      expect(container.querySelector('table')).not.toBeInTheDocument();
    });
  });

  it('renders product rows in the table', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ABCAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('Product 1');
      expect(container.textContent).toContain('P1');
      expect(container.textContent).toContain('1000');
      expect(container.textContent).toContain('80.0%');
    });
  });

  it('renders summary cards with group labels', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ABCAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('Загальна виручка');
      expect(container.textContent).toContain('5000');
      expect(container.textContent).toContain('Група A');
      expect(container.textContent).toContain('Група B');
      expect(container.textContent).toContain('Група C');
      expect(container.textContent).toContain('5 товарів');
      expect(container.textContent).toContain('10 товарів');
      expect(container.textContent).toContain('20 товарів');
    });
  });
});
