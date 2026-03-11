// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import ChannelAnalytics from './ChannelAnalytics';

const mockData = {
  bySource: [
    { source: 'web', orders: 10, revenue: 5000 },
    { source: 'telegram_bot', orders: 5, revenue: 2000 },
    { source: 'custom_source', orders: 2, revenue: 500 },
  ],
  byUtmSource: [{ utmSource: 'google', orders: 8, revenue: 4000 }, { utmSource: null, orders: 2, revenue: 500 }],
  byUtmMedium: [{ utmMedium: 'cpc', orders: 6, revenue: 3000 }],
  byUtmCampaign: [{ utmCampaign: null, orders: 3, revenue: 1000 }],
  channelConversionRates: [
    { source: 'web', visits: 100, conversions: 5, conversionRate: 5 },
    { source: 'social', visits: 200, conversions: 3, conversionRate: 1.5 },
    { source: 'email', visits: 50, conversions: 0, conversionRate: 0 },
  ],
};

describe('ChannelAnalytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<ChannelAnalytics days={30} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders data with totals and source view', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('17');
      expect(container.textContent).toContain('7500');
      expect(container.textContent).toContain('3');
      expect(container.textContent).toContain('Сайт');
      expect(container.textContent).toContain('Telegram бот');
      expect(container.textContent).toContain('custom_source');
    });
  });

  it('returns null on no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('handles zero totalOrders in source view (pct = 0)', async () => {
    const zeroData = {
      ...mockData,
      bySource: [{ source: 'web', orders: 0, revenue: 0 }],
    };
    mockGet.mockResolvedValue({ success: true, data: zeroData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('0.0%');
    });
  });

  it('passes correct days parameter to API', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    render(<ChannelAnalytics days={7} />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/analytics/channels?days=7');
    });
  });

  it('switches to UTM Source view and renders table (line 71, 114-127)', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сайт');
    });

    // Click UTM Source tab
    const utmSourceBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'UTM Source');
    fireEvent.click(utmSourceBtn!);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.textContent).toContain('UTM Source');
      expect(container.textContent).toContain('google');
      expect(container.textContent).toContain('Без мітки'); // null utmSource
      expect(container.textContent).toContain('4000');
      expect(container.textContent).toContain('500');
    });
  });

  it('switches to UTM Medium view and renders table', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сайт');
    });

    const utmMediumBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'UTM Medium');
    fireEvent.click(utmMediumBtn!);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.textContent).toContain('cpc');
      expect(container.textContent).toContain('3000');
    });
  });

  it('switches to UTM Campaign view and renders table', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сайт');
    });

    const utmCampaignBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'UTM Campaign');
    fireEvent.click(utmCampaignBtn!);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.textContent).toContain('Без мітки'); // null utmCampaign
      expect(container.textContent).toContain('1000');
    });
  });

  it('switches to Conversion view and renders conversion table (line 114-142)', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сайт');
    });

    const conversionBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Конверсія'));
    fireEvent.click(conversionBtn!);

    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
      // Headers
      expect(container.textContent).toContain('Канал');
      expect(container.textContent).toContain('Візити');
      expect(container.textContent).toContain('Конверсії');
      expect(container.textContent).toContain('Конверсія %');
      // Data
      expect(container.textContent).toContain('web');
      expect(container.textContent).toContain('100');
      expect(container.textContent).toContain('5%'); // high conversion - green
      expect(container.textContent).toContain('social');
      expect(container.textContent).toContain('1.5%'); // medium - yellow
      expect(container.textContent).toContain('0%'); // low - red
    });
  });

  it('applies correct color styling for conversion rates', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сайт');
    });

    const conversionBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Конверсія'));
    fireEvent.click(conversionBtn!);

    await waitFor(() => {
      const spans = container.querySelectorAll('span.rounded');
      const greenSpan = Array.from(spans).find(s => s.textContent === '5%');
      const yellowSpan = Array.from(spans).find(s => s.textContent === '1.5%');
      const redSpan = Array.from(spans).find(s => s.textContent === '0%');
      expect(greenSpan?.className).toContain('bg-green-100');
      expect(yellowSpan?.className).toContain('bg-yellow-100');
      expect(redSpan?.className).toContain('bg-red-100');
    });
  });

  it('UTM table shows avg check calculated correctly', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сайт');
    });

    const utmSourceBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'UTM Source');
    fireEvent.click(utmSourceBtn!);

    await waitFor(() => {
      // google: 4000/8 = 500, null: 500/2 = 250
      expect(container.textContent).toContain('500 ₴');
      expect(container.textContent).toContain('250 ₴');
    });
  });

  it('UTM table shows 0 avg check when orders is 0', async () => {
    const dataWithZeroOrders = {
      ...mockData,
      byUtmSource: [{ utmSource: 'test', orders: 0, revenue: 0 }],
    };
    mockGet.mockResolvedValue({ success: true, data: dataWithZeroOrders });
    const { container } = render(<ChannelAnalytics days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сайт');
    });

    const utmSourceBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'UTM Source');
    fireEvent.click(utmSourceBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('0 ₴');
    });
  });
});
