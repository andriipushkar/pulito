// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const mockApiGet = vi.fn();

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));
vi.mock('@/components/ui/Button', () => ({
  default: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: any[]) => mockApiGet(...args) },
}));

import RestockReminders from './RestockReminders';

describe('RestockReminders', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('shows loading state initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
    render(<RestockReminders />);
    expect(screen.getByText('Завантаження...')).toBeInTheDocument();
  });

  it('renders the heading', async () => {
    mockApiGet.mockResolvedValue({ data: { predictions: [] } });
    render(<RestockReminders />);
    await waitFor(() => {
      expect(screen.getByText('Нагадування про поповнення')).toBeInTheDocument();
    });
  });

  it('shows empty state when no predictions', async () => {
    mockApiGet.mockResolvedValue({ data: { predictions: [] } });
    render(<RestockReminders />);
    await waitFor(() => {
      expect(screen.getByText(/Ваші прогнози з'являться після кількох покупок/)).toBeInTheDocument();
    });
  });

  it('renders prediction cards with product names', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        predictions: [
          {
            id: 1,
            predictedNextDate: '2025-08-01T00:00:00Z',
            avgIntervalDays: 30,
            confidence: 0.85,
            product: {
              id: 1,
              name: 'Dish Soap',
              slug: 'dish-soap',
              imagePath: '/img/soap.jpg',
              priceRetail: 45,
              images: [],
            },
          },
        ],
      },
    });
    render(<RestockReminders />);
    await waitFor(() => {
      expect(screen.getByText('Dish Soap')).toBeInTheDocument();
    });
  });

  it('renders "Замовити знову" button for each prediction', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        predictions: [
          {
            id: 1,
            predictedNextDate: '2025-08-01T00:00:00Z',
            avgIntervalDays: 30,
            confidence: 0.85,
            product: {
              id: 1,
              name: 'Soap',
              slug: 'soap',
              imagePath: null,
              priceRetail: 45,
              images: [],
            },
          },
        ],
      },
    });
    render(<RestockReminders />);
    await waitFor(() => {
      expect(screen.getByText('Замовити знову')).toBeInTheDocument();
    });
  });

  it('renders predicted date', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        predictions: [
          {
            id: 1,
            predictedNextDate: '2025-08-15T00:00:00Z',
            avgIntervalDays: 30,
            confidence: 0.85,
            product: {
              id: 1,
              name: 'Soap',
              slug: 'soap',
              imagePath: null,
              priceRetail: 45,
              images: [{ pathThumbnail: '/img/thumb.jpg' }],
            },
          },
        ],
      },
    });
    render(<RestockReminders />);
    await waitFor(() => {
      expect(screen.getByText(/Орієнтовно:/)).toBeInTheDocument();
    });
  });
});
