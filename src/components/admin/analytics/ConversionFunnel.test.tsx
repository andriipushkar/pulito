// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}));

import ConversionFunnel from './ConversionFunnel';

describe('ConversionFunnel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<ConversionFunnel />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders funnel data', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        steps: [{ name: 'Visit', value: 100, conversionFromPrev: 100, conversionFromFirst: 100 }],
        totals: { visits: 100 },
      },
    });
    const { container } = render(<ConversionFunnel days={30} />);
    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });

  it('returns null on no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<ConversionFunnel />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders step data in table rows', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        steps: [
          { name: 'Visit', value: 1000, conversionFromPrev: 100, conversionFromFirst: 100 },
          { name: 'Cart', value: 200, conversionFromPrev: 20, conversionFromFirst: 20 },
        ],
        totals: { visits: 1000 },
      },
    });
    const { container } = render(<ConversionFunnel />);
    await waitFor(() => {
      expect(container.textContent).toContain('Visit');
      expect(container.textContent).toContain('Cart');
      expect(container.textContent).toContain('20.0%');
    });
  });

  it('renders heading text', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        steps: [{ name: 'Visit', value: 100, conversionFromPrev: 100, conversionFromFirst: 100 }],
        totals: { visits: 100 },
      },
    });
    const { container } = render(<ConversionFunnel />);
    await waitFor(() => {
      expect(container.textContent).toContain('Воронка конверсії');
    });
  });
});
