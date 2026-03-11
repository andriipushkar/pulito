// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import CustomerLTV from './CustomerLTV';

const mockData = {
  topCustomers: [{
    userId: 1, email: 'a@b.com', fullName: 'John', companyName: null,
    totalSpent: 5000, orderCount: 3, avgCheck: 1666, firstOrderAt: '2024-01-01',
    lastOrderAt: '2024-06-01', lifetimeDays: 152, monthlyValue: 1000, projectedYearlyLTV: 12000,
  }],
  summary: { totalCustomers: 100, totalRevenue: 500000, avgLTV: 5000, medianLTV: 3000 },
  distribution: [{ label: '0-1000', count: 50, revenue: 25000 }],
};

describe('CustomerLTV', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<CustomerLTV days={30} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders LTV data', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerLTV days={30} />);
    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });

  it('returns null on no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<CustomerLTV days={30} />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders customer with companyName', async () => {
    const dataWithCompany = {
      ...mockData,
      topCustomers: [{
        ...mockData.topCustomers[0],
        companyName: 'Acme Corp',
      }],
    };
    mockGet.mockResolvedValue({ success: true, data: dataWithCompany });
    const { container } = render(<CustomerLTV days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Acme Corp');
    });
  });

  it('renders customer without companyName (null)', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerLTV days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('John');
      expect(container.textContent).not.toContain('Acme');
    });
  });

  it('renders formatted dates for first and last order', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { container } = render(<CustomerLTV days={30} />);
    await waitFor(() => {
      expect(container.textContent).toContain('01.01.2024');
      expect(container.textContent).toContain('01.06.2024');
    });
  });
});
