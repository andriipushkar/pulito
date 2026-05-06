// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const mockApiGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: any[]) => mockApiGet(...args) },
}));

import VolumeDiscountBadge from './VolumeDiscountBadge';

describe('VolumeDiscountBadge', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('renders nothing when no discounts are returned', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [] });
    const { container } = render(<VolumeDiscountBadge productId={1} />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders single tier discount badge', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          minQuantity: 10,
          maxQuantity: null,
          discountPercent: 15,
          discountType: 'percentage',
        },
      ],
    });
    render(<VolumeDiscountBadge productId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('volume-discount-badge')).toHaveTextContent(
        'Від 10 шт — знижка 15%',
      );
    });
  });

  it('renders fixed amount suffix for fixed_amount discount type', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          minQuantity: 5,
          maxQuantity: 20,
          discountPercent: 50,
          discountType: 'fixed_amount',
        },
      ],
    });
    render(<VolumeDiscountBadge productId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('volume-discount-badge')).toHaveTextContent(
        'Від 5 шт — знижка 50 грн',
      );
    });
  });

  it('renders multi-tier summary badge', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        { id: 1, minQuantity: 5, maxQuantity: 9, discountPercent: 5, discountType: 'percentage' },
        {
          id: 2,
          minQuantity: 10,
          maxQuantity: null,
          discountPercent: 15,
          discountType: 'percentage',
        },
      ],
    });
    render(<VolumeDiscountBadge productId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('volume-discount-badge')).toHaveTextContent(
        'Гуртова знижка до 15% (від 5 шт)',
      );
    });
  });

  it('calls API with correct productId', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [] });
    render(<VolumeDiscountBadge productId={42} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('productId=42'));
    });
  });

  it('includes categoryId in API call when provided', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [] });
    render(<VolumeDiscountBadge productId={1} categoryId={5} />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('categoryId=5'));
    });
  });
});
