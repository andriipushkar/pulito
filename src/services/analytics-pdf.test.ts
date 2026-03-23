import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('pdfkit', () => {
  const mockDoc = {
    pipe: vi.fn().mockReturnThis(),
    font: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    addPage: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    end: vi.fn(),
    y: 100,
    on: vi.fn(),
  };
  return { default: vi.fn(function () { return mockDoc; }) };
});

vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'finish') setTimeout(cb, 0);
    }),
  })),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/test-uploads' },
}));

vi.mock('@/lib/pdf-theme', () => ({
  BRAND: { text: '#000', textSecondary: '#666', primary: '#0066cc', primaryDark: '#004499', danger: '#cc0000', borderLight: '#eee' },
  FONT_REGULAR: 'Regular',
  PAGE: { margin: 40, contentWidth: 515 },
  setupDoc: vi.fn(),
  drawHeader: vi.fn(),
  drawDocTitle: vi.fn(),
  drawSectionTitle: vi.fn(),
  drawTableHeader: vi.fn(),
  drawTableRow: vi.fn(),
  drawFooter: vi.fn(),
  drawKpiCard: vi.fn(),
  getCompanyInfo: vi.fn().mockResolvedValue({
    name: 'Test Co', email: 'test@co.com', phone: '+380', website: 'test.co', description: 'Test',
  }),
  checkPageBreak: vi.fn(),
}));

vi.mock('./analytics-reports', () => ({
  getStockAnalytics: vi.fn().mockResolvedValue({
    criticalStock: [], deadStock: [], turnoverRates: [],
    summary: { totalProducts: 0, criticalCount: 0, deadStockCount: 0, avgTurnover: 0 },
  }),
  getPriceAnalytics: vi.fn().mockResolvedValue({
    changes: [], promoImpact: [],
    summary: { totalChanges: 0, priceIncreases: 0, priceDecreases: 0, avgChangePercent: 0 },
  }),
  getChannelAnalytics: vi.fn().mockResolvedValue({
    bySource: [], byUtmSource: [], byUtmMedium: [], byUtmCampaign: [], channelConversionRates: [],
  }),
  getGeographyAnalytics: vi.fn().mockResolvedValue({
    cities: [], totalCities: 0, totalOrders: 0, totalRevenue: 0, topCity: null, byDeliveryMethod: [],
  }),
  getCustomerLTV: vi.fn().mockResolvedValue({
    topCustomers: [],
    summary: { totalCustomers: 0, totalRevenue: 0, avgLTV: 0, medianLTV: 0 },
    distribution: [],
  }),
  getCustomerSegmentation: vi.fn().mockResolvedValue({
    segments: [], totalCustomers: 0, totalRevenue: 0,
  }),
}));

import { generateAnalyticsPdf } from './analytics-pdf';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateAnalyticsPdf', () => {
  it('should generate a stock report and return a public URL', async () => {
    const url = await generateAnalyticsPdf('stock', 30);
    expect(url).toMatch(/^\/uploads\/reports\/analytics_stock_\d+\.pdf$/);
  });

  it('should generate a price report', async () => {
    const url = await generateAnalyticsPdf('price', 30);
    expect(url).toMatch(/^\/uploads\/reports\/analytics_price_\d+\.pdf$/);
  });

  it('should generate a channels report', async () => {
    const url = await generateAnalyticsPdf('channels', 30);
    expect(url).toMatch(/^\/uploads\/reports\/analytics_channels_\d+\.pdf$/);
  });

  it('should generate a geography report', async () => {
    const url = await generateAnalyticsPdf('geography', 30);
    expect(url).toMatch(/^\/uploads\/reports\/analytics_geography_\d+\.pdf$/);
  });

  it('should generate an LTV report', async () => {
    const url = await generateAnalyticsPdf('ltv', 365);
    expect(url).toMatch(/^\/uploads\/reports\/analytics_ltv_\d+\.pdf$/);
  });

  it('should generate a segments report', async () => {
    const url = await generateAnalyticsPdf('segments');
    expect(url).toMatch(/^\/uploads\/reports\/analytics_segments_\d+\.pdf$/);
  });

  it('should generate a summary report', async () => {
    const url = await generateAnalyticsPdf('summary', 30);
    expect(url).toMatch(/^\/uploads\/reports\/analytics_summary_\d+\.pdf$/);
  });

  it('should use default 30-day period when days not specified', async () => {
    const url = await generateAnalyticsPdf('stock');
    expect(url).toContain('analytics_stock_');
  });

  it('should create reports directory if it does not exist', async () => {
    const { existsSync, mkdirSync } = await import('fs');
    vi.mocked(existsSync).mockReturnValue(false);

    await generateAnalyticsPdf('stock', 30);

    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('reports'), { recursive: true });
  });

  it('should handle stock report with data', async () => {
    const { getStockAnalytics } = await import('./analytics-reports');
    vi.mocked(getStockAnalytics).mockResolvedValue({
      criticalStock: [{ id: 1, code: 'A1', name: 'Product A', quantity: 5, avgDailySales: 1, daysUntilOut: 5 }],
      deadStock: [],
      turnoverRates: [],
      summary: { totalProducts: 10, criticalCount: 1, deadStockCount: 0, avgTurnover: 1.5 },
    });

    const url = await generateAnalyticsPdf('stock', 30);
    expect(url).toBeTruthy();
  });
});
