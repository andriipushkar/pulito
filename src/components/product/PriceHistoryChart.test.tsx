// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data }: any) => <div data-testid="line-chart" data-count={data?.length}>{children}</div>,
  Line: ({ dataKey, name }: any) => <div data-testid={`line-${dataKey}`}>{name}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: ({ tickFormatter }: any) => <div data-testid="y-axis">{tickFormatter ? tickFormatter(100) : ''}</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ formatter, labelFormatter }: any) => {
    const formatted = formatter ? formatter(99.5) : '';
    const label = labelFormatter ? labelFormatter('01.01') : '';
    return <div data-testid="tooltip">{formatted}{label}</div>;
  },
  Legend: () => <div data-testid="legend" />,
}));

import PriceHistoryChart from './PriceHistoryChart';

describe('PriceHistoryChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PriceHistoryChart productSlug="test" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when API returns empty data', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    });
    const { container } = render(<PriceHistoryChart productSlug="test" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/products/test/price-history');
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when API returns success: false', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false, data: [] }),
    });
    const { container } = render(<PriceHistoryChart productSlug="test" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when API fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { container } = render(<PriceHistoryChart productSlug="test" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders chart when data is available', async () => {
    const priceData = [
      { id: 1, priceRetailNew: '100.50', priceWholesaleNew: '80.00', changedAt: '2024-01-15T10:00:00Z' },
      { id: 2, priceRetailNew: '110.00', priceWholesaleNew: '90.00', changedAt: '2024-02-15T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: priceData }),
    });

    const { findByText, getByTestId } = render(<PriceHistoryChart productSlug="test-product" />);
    expect(await findByText('Історія цін')).toBeInTheDocument();
    expect(getByTestId('responsive-container')).toBeInTheDocument();
    expect(getByTestId('line-chart')).toBeInTheDocument();
    expect(getByTestId('line-retail')).toBeInTheDocument();
    expect(getByTestId('line-wholesale')).toBeInTheDocument();
  });

  it('handles null priceRetailNew and priceWholesaleNew', async () => {
    const priceData = [
      { id: 1, priceRetailNew: null, priceWholesaleNew: null, changedAt: '2024-01-15T10:00:00Z' },
      { id: 2, priceRetailNew: '110.00', priceWholesaleNew: null, changedAt: '2024-02-15T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: priceData }),
    });

    const { findByText } = render(<PriceHistoryChart productSlug="test-product" />);
    expect(await findByText('Історія цін')).toBeInTheDocument();
  });

  it('fetches with correct slug', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<PriceHistoryChart productSlug="my-slug" />);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/products/my-slug/price-history');
  });

  it('formats YAxis tick and Tooltip correctly', async () => {
    const priceData = [
      { id: 1, priceRetailNew: '100.50', priceWholesaleNew: '80.00', changedAt: '2024-01-15T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: priceData }),
    });

    const { findByTestId } = render(<PriceHistoryChart productSlug="test" />);
    const yAxis = await findByTestId('y-axis');
    expect(yAxis.textContent).toContain('100 ₴');

    const tooltip = await findByTestId('tooltip');
    expect(tooltip.textContent).toContain('99.50 ₴');
    expect(tooltip.textContent).toContain('Дата: 01.01');
  });

  it('renders chart data with correct structure for mixed null values', async () => {
    const priceData = [
      { id: 1, priceRetailNew: '50.00', priceWholesaleNew: null, changedAt: '2024-03-01T10:00:00Z' },
      { id: 2, priceRetailNew: null, priceWholesaleNew: '40.00', changedAt: '2024-04-01T10:00:00Z' },
    ];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: priceData }),
    });

    const { findByTestId } = render(<PriceHistoryChart productSlug="test" />);
    const chart = await findByTestId('line-chart');
    expect(chart.getAttribute('data-count')).toBe('2');
  });
});
