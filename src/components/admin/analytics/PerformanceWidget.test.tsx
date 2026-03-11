// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import PerformanceWidget from './PerformanceWidget';

describe('PerformanceWidget', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<PerformanceWidget />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty state when no metrics', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      expect(container.textContent).toContain('Немає даних');
    });
  });

  it('renders metrics cards', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'LCP', p50: 1000, p75: 2000, p90: 3000, sampleCount: 100 },
        { date: '2024-01-01', route: '/', metric: 'CLS', p50: 0.05, p75: 0.08, p90: 0.12, sampleCount: 50 },
      ],
    });
    const { container } = render(<PerformanceWidget days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('LCP');
      expect(container.textContent).toContain('CLS');
    });
  });

  it('shows "Good" label for metrics within good threshold', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'LCP', p50: 1000, p75: 2000, p90: 2500, sampleCount: 100 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      expect(container.textContent).toContain('Good');
    });
  });

  it('shows "Needs improvement" label for metrics between good and poor', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'LCP', p50: 2000, p75: 3500, p90: 4500, sampleCount: 100 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      expect(container.textContent).toContain('Needs improvement');
    });
  });

  it('shows "Poor" label for metrics exceeding poor threshold', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'LCP', p50: 3000, p75: 5000, p90: 7000, sampleCount: 100 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      expect(container.textContent).toContain('Poor');
    });
  });

  it('renders CLS values with 3 decimal places', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'CLS', p50: 0.05, p75: 0.08, p90: 0.12, sampleCount: 50 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      expect(container.textContent).toContain('0.080');
      expect(container.textContent).toContain('0.050');
      expect(container.textContent).toContain('0.120');
    });
  });

  it('renders non-CLS values as rounded integers with unit', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'TTFB', p50: 500, p75: 750, p90: 1200, sampleCount: 80 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      expect(container.textContent).toContain('750');
      expect(container.textContent).toContain('ms');
    });
  });

  it('uses latest date per metric when multiple dates exist', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'LCP', p50: 1000, p75: 2000, p90: 3000, sampleCount: 50 },
        { date: '2024-01-15', route: '/', metric: 'LCP', p50: 800, p75: 1500, p90: 2000, sampleCount: 100 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      // Should use the Jan 15 data (p75=1500, rounded to 1500)
      expect(container.textContent).toContain('1500');
      expect(container.textContent).toContain('100'); // sampleCount of latest
    });
  });

  it('renders sample count for each metric', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'FCP', p50: 1000, p75: 1500, p90: 2500, sampleCount: 42 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      expect(container.textContent).toContain('Samples');
      expect(container.textContent).toContain('42');
    });
  });

  it('handles unknown metric gracefully', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        { date: '2024-01-01', route: '/', metric: 'UNKNOWN_METRIC', p50: 100, p75: 200, p90: 300, sampleCount: 10 },
      ],
    });
    const { container } = render(<PerformanceWidget />);
    await waitFor(() => {
      // Unknown metrics are filtered out by metricOrder
      expect(container.textContent).not.toContain('UNKNOWN_METRIC');
    });
  });
});
