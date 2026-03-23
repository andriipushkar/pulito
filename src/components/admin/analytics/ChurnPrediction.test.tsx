// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...args: any[]) => mockGet(...args) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import ChurnPrediction from './ChurnPrediction';

const mockData = {
  churnRate: 15.5,
  retentionRate: 84.5,
  avgDaysBetweenOrders: 30,
  atRiskCustomers: [
    { id: 1, email: 'test@test.com', fullName: 'Test User', lastOrderDate: '2024-01-01', daysSinceLastOrder: 90, totalOrders: 5, totalSpent: 5000, churnProbability: 85 },
  ],
  churnByMonth: [
    { month: '2024-01', churned: 5, retained: 95, rate: 5 },
  ],
};

describe('ChurnPrediction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<ChurnPrediction days={30} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders churn data on success', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { getByText } = render(<ChurnPrediction days={30} />);
    await waitFor(() => {
      expect(getByText('15.5%')).toBeInTheDocument();
      expect(getByText('84.5%')).toBeInTheDocument();
    });
  });

  it('shows fallback when no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { getByText } = render(<ChurnPrediction days={30} />);
    await waitFor(() => {
      expect(getByText('Дані прогнозу відтоку недоступні')).toBeInTheDocument();
    });
  });

  it('renders at-risk customers table', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { getByText } = render(<ChurnPrediction days={30} />);
    await waitFor(() => {
      expect(getByText('Test User')).toBeInTheDocument();
      expect(getByText('85%')).toBeInTheDocument();
    });
  });

  it('renders churn by month chart', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { getAllByText } = render(<ChurnPrediction days={30} />);
    await waitFor(() => {
      expect(getAllByText('Відтік по місяцях').length).toBeGreaterThan(0);
    });
  });
});
