// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import CustomerSegmentation from './CustomerSegmentation';

const mockData = {
  segments: [
    {
      segment: 'champions', label: 'Champions', count: 10, revenue: 50000, avgCheck: 5000,
      customers: [{ userId: 1, email: 'a@b.com', fullName: 'John', lastOrderDays: 5, orderCount: 10, totalSpent: 50000 }],
    },
    {
      segment: 'lost', label: 'Lost', count: 5, revenue: 1000, avgCheck: 200,
      customers: [{ userId: 2, email: 'c@d.com', fullName: null, lastOrderDays: 180, orderCount: 1, totalSpent: 200 }],
    },
    {
      segment: 'unknown_segment', label: 'Unknown', count: 0, revenue: 0, avgCheck: 0,
      customers: [],
    },
  ],
  totalCustomers: 100,
  totalRevenue: 500000,
};

describe('CustomerSegmentation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<CustomerSegmentation />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders segments with totals', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('100'); // totalCustomers
      expect(container.textContent).toContain('500000 ₴'); // totalRevenue
      expect(container.textContent).toContain('Champions');
      expect(container.textContent).toContain('Lost');
      expect(container.textContent).toContain('Unknown');
    });
  });

  it('returns null on no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('expands segment to show customers table', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container, getByText } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('Champions');
    });

    // Click on Champions segment
    const championsBtn = container.querySelectorAll('button.flex.w-full')[0];
    fireEvent.click(championsBtn);

    // Should show customer table
    await waitFor(() => {
      expect(container.textContent).toContain('a@b.com');
      expect(container.textContent).toContain('John');
      expect(container.textContent).toContain('50000 ₴');
    });
  });

  it('collapses expanded segment on second click', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('Champions');
    });

    const championsBtn = container.querySelectorAll('button.flex.w-full')[0];
    // Expand
    fireEvent.click(championsBtn);
    await waitFor(() => {
      expect(container.textContent).toContain('a@b.com');
    });
    // Collapse
    fireEvent.click(championsBtn);
    await waitFor(() => {
      expect(container.textContent).not.toContain('a@b.com');
    });
  });

  it('shows dash for null fullName', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('Lost');
    });

    // Click Lost segment
    const lostBtn = container.querySelectorAll('button.flex.w-full')[1];
    fireEvent.click(lostBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('c@d.com');
      // fullName is null, should show dash
      const cells = container.querySelectorAll('td');
      const nameCell = Array.from(cells).find(c => c.textContent === '—');
      expect(nameCell).toBeTruthy();
    });
  });

  it('does not show customer table when expanded segment has no customers', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('Unknown');
    });

    // Click Unknown segment (count: 0, customers: [])
    const unknownBtn = container.querySelectorAll('button.flex.w-full')[2];
    fireEvent.click(unknownBtn);

    // No table should appear since customers.length === 0
    await waitFor(() => {
      const tables = container.querySelectorAll('table');
      // There shouldn't be a customers table visible
      expect(tables.length).toBe(0);
    });
  });

  it('renders segment bar chart with correct widths', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('Champions');
    });

    // Segments with count > 0 should have bar segments
    const bars = container.querySelectorAll('.flex.items-center.justify-center');
    // champions (10) and lost (5) have count > 0, unknown (0) is filtered out
    expect(bars.length).toBe(2);
  });

  it('shows count in bar only when percentage >= 5%', async () => {
    const dataWithSmallSegment = {
      ...mockData,
      segments: [
        { segment: 'champions', label: 'Champions', count: 10, revenue: 50000, avgCheck: 5000, customers: [] },
        { segment: 'new', label: 'New', count: 1, revenue: 100, avgCheck: 100, customers: [] },
      ],
      totalCustomers: 100,
    };
    mockGet.mockResolvedValue({ success: true, data: dataWithSmallSegment });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      const bars = container.querySelectorAll('.flex.items-center.justify-center');
      // Champions: 10/100 = 10% >= 5, should show count
      expect(bars[0].textContent).toBe('10');
      // New: 1/100 = 1% < 5, should be empty
      expect(bars[1].textContent).toBe('');
    });
  });

  it('handles totalCustomers = 0 gracefully', async () => {
    const zeroData = {
      segments: [{ segment: 'champions', label: 'Champions', count: 0, revenue: 0, avgCheck: 0, customers: [] }],
      totalCustomers: 0,
      totalRevenue: 0,
    };
    mockGet.mockResolvedValue({ success: true, data: zeroData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('0'); // totalCustomers
      // Percentage should show 0 when totalCustomers is 0
      expect(container.textContent).toContain('(0%)');
    });
  });

  it('uses fallback color for unknown segment', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      // The unknown_segment should use fallback color #94a3b8
      const colorDots = container.querySelectorAll('.h-3.w-3.rounded-sm');
      const unknownDot = Array.from(colorDots).find(d =>
        (d as HTMLElement).style.backgroundColor === '#94a3b8' ||
        (d as HTMLElement).style.backgroundColor === 'rgb(148, 163, 184)'
      );
      expect(unknownDot).toBeTruthy();
    });
  });

  it('displays segment percentage in card', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerSegmentation />);
    await waitFor(() => {
      expect(container.textContent).toContain('10.0%'); // champions: 10/100
      expect(container.textContent).toContain('5.0%'); // lost: 5/100
    });
  });
});
