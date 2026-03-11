// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import GeographyAnalytics from './GeographyAnalytics';

const mockData = {
  cities: [
    { city: 'Kyiv', orders: 50, revenue: 100000, ordersPercent: 50, revenuePercent: 60, avgCheck: 2000 },
    { city: 'Lviv', orders: 30, revenue: 60000, ordersPercent: 30, revenuePercent: 25, avgCheck: 2000 },
  ],
  totalCities: 10,
  totalOrders: 100,
  totalRevenue: 200000,
  topCity: { city: 'Kyiv', orders: 50, revenue: 100000, ordersPercent: 50, revenuePercent: 60, avgCheck: 2000 },
  byDeliveryMethod: [
    { method: 'nova_poshta', orders: 80, revenue: 160000 },
    { method: 'self_pickup', orders: 10, revenue: 20000 },
    { method: 'custom_method', orders: 10, revenue: 20000 },
  ],
};

describe('GeographyAnalytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<GeographyAnalytics days={30} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders geography data with summary cards', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('10');
      expect(container.textContent).toContain('100');
      expect(container.textContent).toContain('200000 ₴');
      expect(container.textContent).toContain('Kyiv');
    });
  });

  it('returns null on no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders city heatmap bars', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Kyiv');
      expect(container.textContent).toContain('Lviv');
      expect(container.textContent).toContain('50%');
      expect(container.textContent).toContain('30%');
    });
  });

  it('renders delivery methods with labels and percentages (lines 72-78)', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Нова Пошта');
      expect(container.textContent).toContain('Самовивіз');
      expect(container.textContent).toContain('custom_method');
      // Check percentage: nova_poshta 80/100 = 80.0%
      expect(container.textContent).toContain('80.0%');
      // Check revenue display
      expect(container.textContent).toContain('160000 ₴');
      expect(container.textContent).toContain('20000 ₴');
      // Check order counts
      expect(container.textContent).toContain('80 зам.');
      expect(container.textContent).toContain('10 зам.');
    });
  });

  it('renders full city table with all columns including avgCheck (line 136)', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      const tables = container.querySelectorAll('table');
      expect(tables.length).toBeGreaterThan(0);
      expect(container.textContent).toContain('Місто');
      expect(container.textContent).toContain('Замовлень');
      expect(container.textContent).toContain('% замовлень');
      expect(container.textContent).toContain('Виручка');
      expect(container.textContent).toContain('% виручки');
      expect(container.textContent).toContain('Сер. чек');
      // avgCheck values
      expect(container.textContent).toContain('2000 ₴');
    });
  });

  it('handles zero totalOrders for delivery method percentage', async () => {
    const zeroData = {
      ...mockData,
      totalOrders: 0,
      byDeliveryMethod: [{ method: 'nova_poshta', orders: 0, revenue: 0 }],
    };
    mockGet.mockResolvedValue({ success: true, data: zeroData });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('0.0%');
    });
  });

  it('handles no topCity (null)', async () => {
    const noTopCity = {
      ...mockData,
      topCity: null,
    };
    mockGet.mockResolvedValue({ success: true, data: noTopCity });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('—');
    });
  });

  it('handles empty cities array', async () => {
    const emptyCities = {
      ...mockData,
      cities: [],
      totalCities: 0,
    };
    mockGet.mockResolvedValue({ success: true, data: emptyCities });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('0');
    });
  });

  it('passes correct days parameter to API', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    render(<GeographyAnalytics days={7} />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/analytics/geography?days=7');
    });
  });

  it('limits city heatmap to 20 cities', async () => {
    const manyCities = Array.from({ length: 25 }, (_, i) => ({
      city: `City${i}`, orders: 25 - i, revenue: (25 - i) * 1000,
      ordersPercent: 4, revenuePercent: 4, avgCheck: 1000,
    }));
    const bigData = {
      ...mockData,
      cities: manyCities,
    };
    mockGet.mockResolvedValue({ success: true, data: bigData });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      const heatmapBars = container.querySelectorAll('.w-28.truncate');
      expect(heatmapBars.length).toBe(20);
    });
  });

  it('renders delivery method progress bars with correct width styles', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<GeographyAnalytics days={30} />);
    await waitFor(() => {
      // The delivery section has progress bars with width styles
      const deliverySection = container.querySelectorAll('.h-1\\.5');
      expect(deliverySection.length).toBeGreaterThan(0);
    });
  });
});
