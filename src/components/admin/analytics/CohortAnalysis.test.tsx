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
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import CohortAnalysis from './CohortAnalysis';

describe('CohortAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<CohortAnalysis />);
    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty state when no data', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    const { container } = render(<CohortAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('Недостатньо даних');
    });
  });

  it('renders cohort table', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [{ cohort: '2024-01', totalUsers: 10, retention: { '2024-02': 50 } }],
    });
    const { container } = render(<CohortAnalysis months={6} />);
    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });
});
