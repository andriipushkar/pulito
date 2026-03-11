// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

import DeliveryCostEstimate from './DeliveryCostEstimate';

async function advanceTimerAndFlush() {
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
}

describe('DeliveryCostEstimate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when deliveryMethod is undefined', () => {
    const { container } = render(
      <DeliveryCostEstimate deliveryMethod={undefined} city="" cartTotal={500} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when deliveryMethod is pickup', () => {
    const { container } = render(
      <DeliveryCostEstimate deliveryMethod="pickup" city="" cartTotal={500} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('fetches estimate and shows delivery cost', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { cost: 75, estimatedDays: '1-2 дні', freeFrom: 1000 },
    });
    render(
      <DeliveryCostEstimate deliveryMethod="nova_poshta" city="Київ" cartTotal={500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/v1/delivery/estimate?'));
    });
    await waitFor(() => {
      expect(screen.getAllByText('75 ₴')[0]).toBeInTheDocument();
    });
  });

  it('displays free delivery text when cost is zero', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { cost: 0, estimatedDays: '1-2 дні', freeFrom: null },
    });
    render(
      <DeliveryCostEstimate deliveryMethod="nova_poshta" city="Київ" cartTotal={1500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      expect(screen.getAllByText('Безкоштовно')[0]).toBeInTheDocument();
    });
  });

  it('displays calculating text when cost is null', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { cost: null, estimatedDays: null, freeFrom: null },
    });
    render(
      <DeliveryCostEstimate deliveryMethod="nova_poshta" city="Київ" cartTotal={500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      expect(screen.getAllByText('Розраховується')[0]).toBeInTheDocument();
    });
  });

  it('shows estimated delivery days when available', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { cost: 50, estimatedDays: '2-3 дні', freeFrom: null },
    });
    render(
      <DeliveryCostEstimate deliveryMethod="nova_poshta" city="Київ" cartTotal={500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      expect(screen.getAllByText(/Термін доставки: 2-3 дні/)[0]).toBeInTheDocument();
    });
  });

  it('shows free delivery threshold and remaining amount', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { cost: 75, estimatedDays: null, freeFrom: 1000 },
    });
    render(
      <DeliveryCostEstimate deliveryMethod="nova_poshta" city="Київ" cartTotal={500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      expect(screen.getAllByText(/Безкоштовна доставка від 1000 ₴/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/ще 500 ₴/)[0]).toBeInTheDocument();
    });
  });

  it('passes correct method and city to API', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { cost: 100, estimatedDays: null, freeFrom: null },
    });
    render(
      <DeliveryCostEstimate deliveryMethod="ukrposhta" city="Львів" cartTotal={500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('method=ukrposhta');
      expect(url).toContain('city=');
    });
  });

  it('sets estimate to null when API returns non-success', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(
      <DeliveryCostEstimate deliveryMethod="nova_poshta" city="Київ" cartTotal={500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
    // estimate is null so component renders nothing
    expect(container.innerHTML).toBe('');
  });

  it('resets view when deliveryMethod changes to pickup', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { cost: 75, estimatedDays: null, freeFrom: null },
    });
    const { rerender, container } = render(
      <DeliveryCostEstimate deliveryMethod="nova_poshta" city="Київ" cartTotal={500} />
    );
    await advanceTimerAndFlush();
    await waitFor(() => {
      expect(screen.getAllByText('75 ₴')[0]).toBeInTheDocument();
    });
    rerender(
      <DeliveryCostEstimate deliveryMethod="pickup" city="Київ" cartTotal={500} />
    );
    expect(container.innerHTML).toBe('');
  });
});
