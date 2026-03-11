// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: any[]) => mockGet(...a) } }));
vi.mock('@/components/ui/Spinner', () => ({ default: () => <div data-testid="spinner" /> }));

import CohortAnalysis from './CohortAnalysis';

describe('CohortAnalysis', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
    mockGet.mockResolvedValue({ success: true, data: [{ cohort: '2024-01', totalUsers: 10, retention: { '2024-02': 50 } }] });
    const { container } = render(<CohortAnalysis months={6} />);
    await waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });
  });
});
