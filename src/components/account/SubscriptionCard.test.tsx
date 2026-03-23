// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick, disabled, isLoading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || isLoading} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/Badge', () => ({
  default: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    patch: (...args: any[]) => mockPatch(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import SubscriptionCard from './SubscriptionCard';

const makeSubscription = (overrides: any = {}) => ({
  id: 1,
  frequency: 'monthly',
  status: 'active',
  nextDeliveryAt: '2025-07-15T00:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
  items: [
    {
      id: 1,
      quantity: 2,
      product: { id: 10, name: 'Dish Soap', code: 'DS-001', priceRetail: 45.50, imagePath: '/img/soap.jpg' },
    },
    {
      id: 2,
      quantity: 1,
      product: { id: 20, name: 'Laundry Detergent', code: 'LD-002', priceRetail: 120.00, imagePath: null },
    },
  ],
  ...overrides,
});

describe('SubscriptionCard', () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    onUpdate.mockReset();
    mockPatch.mockReset().mockResolvedValue({ success: true });
    mockDelete.mockReset().mockResolvedValue({ success: true });
  });

  it('renders frequency label', () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    expect(screen.getByText('Щомісяця')).toBeInTheDocument();
  });

  it('renders status label', () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    expect(screen.getByText('Активна')).toBeInTheDocument();
  });

  it('renders item names', () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    expect(screen.getByText('Dish Soap')).toBeInTheDocument();
    expect(screen.getByText('Laundry Detergent')).toBeInTheDocument();
  });

  it('calculates and renders total price', () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    // 2 * 45.50 + 1 * 120.00 = 211.00
    expect(screen.getByText('211.00 ₴')).toBeInTheDocument();
  });

  it('renders next delivery date for active subscription', () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    expect(screen.getByText(/Наступна доставка/)).toBeInTheDocument();
  });

  it('shows pause button for active subscription', () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    expect(screen.getByText('Призупинити')).toBeInTheDocument();
  });

  it('shows resume button for paused subscription', () => {
    render(<SubscriptionCard subscription={makeSubscription({ status: 'paused' })} onUpdate={onUpdate} />);
    expect(screen.getByText('Відновити')).toBeInTheDocument();
  });

  it('hides action buttons for cancelled subscription', () => {
    render(<SubscriptionCard subscription={makeSubscription({ status: 'cancelled' })} onUpdate={onUpdate} />);
    expect(screen.queryByText('Призупинити')).not.toBeInTheDocument();
    expect(screen.queryByText('Скасувати')).not.toBeInTheDocument();
  });

  it('calls onUpdate after pause action', async () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('Призупинити'));
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/api/v1/me/subscriptions/1', { status: 'paused' });
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('calls delete on cancel action', async () => {
    render(<SubscriptionCard subscription={makeSubscription()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('Скасувати'));
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/me/subscriptions/1');
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
