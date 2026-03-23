// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUser = vi.hoisted(() => ({ value: { id: 1, name: 'Test User' } as Record<string, unknown> | null }));
const mockCreateSubscription = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser.value }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useCreateSubscription: () => ({ createSubscription: mockCreateSubscription }),
}));

import SubscribeButton from './SubscribeButton';

const baseProps = {
  productId: 42,
  productName: 'Порошок для прання',
  price: 200,
};

describe('SubscribeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = { id: 1, name: 'Test User' };
    mockCreateSubscription.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders button with correct text', () => {
    const { getByText } = render(<SubscribeButton {...baseProps} />);
    expect(getByText(/Підписатись та заощадити 5%/)).toBeInTheDocument();
  });

  it('renders green discount badge', () => {
    const { getByText } = render(<SubscribeButton {...baseProps} />);
    expect(getByText('-5%')).toBeInTheDocument();
  });

  it('shows frequency dropdown on click', () => {
    const { getByText, queryByText } = render(<SubscribeButton {...baseProps} />);

    // Dropdown not visible initially
    expect(queryByText('Щотижня (7 днів)')).not.toBeInTheDocument();

    // Click the button
    fireEvent.click(getByText(/Підписатись та заощадити/));

    // All frequency options visible
    expect(getByText('Щотижня (7 днів)')).toBeInTheDocument();
    expect(getByText('Раз на 2 тижні (14 днів)')).toBeInTheDocument();
    expect(getByText('Щомісяця (30 днів)')).toBeInTheDocument();
    expect(getByText('Раз на 2 місяці (60 днів)')).toBeInTheDocument();
  });

  it('shows discounted price for each frequency option', () => {
    const { getByText, getAllByText } = render(<SubscribeButton {...baseProps} />);
    fireEvent.click(getByText(/Підписатись та заощадити/));

    // 200 * 0.95 = 190.00
    const discountedPrices = getAllByText('190.00 ₴');
    expect(discountedPrices).toHaveLength(4); // one per frequency option
  });

  it('shows savings in footer', () => {
    const { getByText } = render(<SubscribeButton {...baseProps} />);
    fireEvent.click(getByText(/Підписатись та заощадити/));

    // Savings: 200 - 190 = 10.00
    expect(getByText(/Економія: 10.00 ₴/)).toBeInTheDocument();
    expect(getByText('200.00 ₴')).toBeInTheDocument();
  });

  it('calls createSubscription on frequency selection', async () => {
    const { getByText } = render(<SubscribeButton {...baseProps} />);
    fireEvent.click(getByText(/Підписатись та заощадити/));
    fireEvent.click(getByText('Щомісяця (30 днів)'));

    await waitFor(() => {
      expect(mockCreateSubscription).toHaveBeenCalledWith({
        frequency: 'monthly',
        items: [{ productId: 42, quantity: 1 }],
      });
    });
  });

  it('shows success message after subscription', async () => {
    const { getByText } = render(<SubscribeButton {...baseProps} />);
    fireEvent.click(getByText(/Підписатись та заощадити/));
    fireEvent.click(getByText('Щотижня (7 днів)'));

    await waitFor(() => {
      expect(getByText('Підписку створено!')).toBeInTheDocument();
    });
  });

  it('shows error message when subscription fails', async () => {
    mockCreateSubscription.mockResolvedValue({ success: false, error: 'Server error' });

    const { getByText } = render(<SubscribeButton {...baseProps} />);
    fireEvent.click(getByText(/Підписатись та заощадити/));
    fireEvent.click(getByText('Щомісяця (30 днів)'));

    await waitFor(() => {
      expect(getByText('Server error')).toBeInTheDocument();
    });
  });

  it('shows login prompt when not authenticated', () => {
    mockUser.value = null;

    const { getByText } = render(<SubscribeButton {...baseProps} />);
    fireEvent.click(getByText(/Підписатись та заощадити/));

    expect(getByText(/Увійдіть в акаунт/)).toBeInTheDocument();
    expect(getByText('Увійти')).toBeInTheDocument();
  });
});
