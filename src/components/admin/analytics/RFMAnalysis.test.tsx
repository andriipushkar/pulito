// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Local next-intl mock: resolve real Ukrainian copy (with ICU) from messages so
// translated-text assertions match production, overriding the global passthrough.
vi.mock('next-intl', async (importActual) => {
  const actual = await importActual<any>();
  const uk = (await import('@/messages/uk.json')).default;
  return {
    ...actual,
    useTranslations: (ns?: string) =>
      actual.createTranslator({ locale: 'uk', messages: uk, namespace: ns }),
    useLocale: () => 'uk',
    useFormatter: () => actual.createFormatter({ locale: 'uk' }),
  };
});

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...args: any[]) => mockGet(...args) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import RFMAnalysis from './RFMAnalysis';

const mockData = {
  totalCustomers: 100,
  segments: [
    {
      segment: 'champions',
      label: 'Champions',
      count: 20,
      avgRecency: 5,
      avgFrequency: 10,
      avgMonetary: 5000,
      color: '#22c55e',
    },
    {
      segment: 'loyal',
      label: 'Loyal',
      count: 30,
      avgRecency: 15,
      avgFrequency: 5,
      avgMonetary: 2000,
      color: '#3b82f6',
    },
    {
      segment: 'at_risk',
      label: 'At Risk',
      count: 10,
      avgRecency: 60,
      avgFrequency: 2,
      avgMonetary: 500,
      color: '#dc2626',
    },
  ],
};

describe('RFMAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<RFMAnalysis days={30} />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders RFM segments on success', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { getByText } = render(<RFMAnalysis days={30} />);
    await waitFor(() => {
      expect(getByText('Чемпіони')).toBeInTheDocument();
      expect(getByText('Лояльні')).toBeInTheDocument();
      expect(getByText('Під загрозою')).toBeInTheDocument();
    });
  });

  it('shows segment counts and percentages', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { getByText } = render(<RFMAnalysis days={30} />);
    await waitFor(() => {
      expect(getByText('20')).toBeInTheDocument();
      expect(getByText('20.0% клієнтів')).toBeInTheDocument();
    });
  });

  it('shows fallback when no data', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { getByText } = render(<RFMAnalysis days={30} />);
    await waitFor(() => {
      expect(getByText('Дані RFM-аналізу недоступні')).toBeInTheDocument();
    });
  });

  it('renders recommendations section', async () => {
    mockGet.mockResolvedValue({ success: true, data: mockData });
    const { getAllByText } = render(<RFMAnalysis days={30} />);
    await waitFor(() => {
      expect(getAllByText('Рекомендації').length).toBeGreaterThan(0);
    });
  });
});
