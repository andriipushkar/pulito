// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
  getAccessToken: () => mockGetAccessToken(),
}));
vi.mock('./ReviewImageGallery', () => ({
  default: ({ images }: any) => <div data-testid="review-image-gallery">{images.length} images</div>,
}));
vi.mock('./ReviewImageUpload', () => ({
  default: ({ onChange }: any) => <div data-testid="review-image-upload" />,
}));

import ReviewSection from './ReviewSection';

const makeReviewsResponse = (overrides: any = {}) => ({
  success: true,
  data: {
    reviews: [
      {
        id: 1,
        rating: 5,
        title: 'Great product',
        comment: 'Really loved it',
        pros: 'Good quality',
        cons: null,
        isVerifiedPurchase: true,
        helpfulCount: 3,
        images: null,
        adminReply: null,
        adminReplyAt: null,
        createdAt: '2025-06-01T10:00:00Z',
        user: { id: 1, fullName: 'Test User', avatarUrl: null },
      },
    ],
    stats: {
      averageRating: 4.5,
      totalReviews: 10,
      distribution: { 5: 5, 4: 3, 3: 1, 2: 1, 1: 0 },
    },
    total: 1,
    page: 1,
    limit: 10,
    ...overrides,
  },
});

describe('ReviewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
    mockApiGet.mockResolvedValue(makeReviewsResponse());
  });

  it('renders the heading "Відгуки"', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Відгуки')).toBeInTheDocument();
    });
  });

  it('renders review count in heading', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('(10)')).toBeInTheDocument();
    });
  });

  it('renders average rating', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('4.5')).toBeInTheDocument();
    });
  });

  it('renders review author name', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });

  it('renders review title', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Great product')).toBeInTheDocument();
    });
  });

  it('renders review comment', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Really loved it')).toBeInTheDocument();
    });
  });

  it('renders verified purchase badge', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Підтверджена покупка')).toBeInTheDocument();
    });
  });

  it('renders pros section', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Good quality')).toBeInTheDocument();
    });
  });

  it('renders empty state when no reviews', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: {
        reviews: [],
        stats: { averageRating: 0, totalReviews: 0, distribution: {} },
        total: 0,
        page: 1,
        limit: 10,
      },
    });
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Поки що немає відгуків')).toBeInTheDocument();
    });
  });

  it('renders sort dropdown', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Сортувати:')).toBeInTheDocument();
    });
  });

  it('shows "Написати відгук" button when logged in', async () => {
    mockGetAccessToken.mockReturnValue('token123');
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Написати відгук')).toBeInTheDocument();
    });
  });

  it('hides "Написати відгук" button when not logged in', async () => {
    mockGetAccessToken.mockReturnValue(null);
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.queryByText('Написати відгук')).not.toBeInTheDocument();
    });
  });

  it('renders helpful button with count', async () => {
    render(<ReviewSection productId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Корисно (3)')).toBeInTheDocument();
    });
  });
});
