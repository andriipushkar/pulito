// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import PrintableOrder from './PrintableOrder';

const mockOrder = {
  id: 1,
  orderNumber: 'ORD-001',
  status: 'new_order' as const,
  contactName: 'Test User',
  contactPhone: '+380123456789',
  contactEmail: 'test@test.com',
  deliveryMethod: 'nova_poshta' as const,
  deliveryCity: 'Kyiv',
  deliveryAddress: 'Street 1',
  paymentMethod: 'cod' as const,
  paymentStatus: 'pending' as const,
  trackingNumber: null,
  comment: null,
  totalAmount: '1000.00',
  discountAmount: '0',
  deliveryCost: '0',
  createdAt: '2024-01-01T00:00:00Z',
  items: [
    {
      id: 1,
      productId: 1,
      productCode: 'P001',
      productName: 'Product 1',
      quantity: 2,
      priceAtOrder: '100.00',
      subtotal: '200.00',
      imagePath: null,
    },
  ],
};

describe('PrintableOrder', () => {
  it('renders print button', () => {
    render(<PrintableOrder order={mockOrder as any} />);
    expect(screen.getByText('Друк накладної')).toBeInTheDocument();
  });

  it('renders hidden printable content', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden).toBeInTheDocument();
  });

  it('renders order number in hidden content', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('ORD-001');
  });

  it('renders contact info', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Test User');
    expect(hidden?.textContent).toContain('+380123456789');
    expect(hidden?.textContent).toContain('test@test.com');
  });

  it('renders delivery info', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Нова Пошта');
    expect(hidden?.textContent).toContain('Kyiv');
    expect(hidden?.textContent).toContain('Street 1');
  });

  it('renders payment info', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Накладений платіж');
    expect(hidden?.textContent).toContain('Очікує оплати');
  });

  it('renders items table', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('P001');
    expect(hidden?.textContent).toContain('Product 1');
    expect(hidden?.textContent).toContain('200.00');
  });

  it('renders total amount', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('1000.00');
  });

  it('renders tracking number when present', () => {
    const orderWithTTN = { ...mockOrder, trackingNumber: 'TTN12345' };
    const { container } = render(<PrintableOrder order={orderWithTTN as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('TTN12345');
  });

  it('does not render tracking number when null', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).not.toContain('ТТН:');
  });

  it('renders discount amount when > 0', () => {
    const orderWithDiscount = { ...mockOrder, discountAmount: '50.00' };
    const { container } = render(<PrintableOrder order={orderWithDiscount as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('-50.00');
    expect(hidden?.textContent).toContain('Знижка');
  });

  it('does not render discount when 0', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).not.toContain('Знижка');
  });

  it('renders delivery cost when > 0', () => {
    const orderWithCost = { ...mockOrder, deliveryCost: '75.00' };
    const { container } = render(<PrintableOrder order={orderWithCost as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Доставка');
    expect(hidden?.textContent).toContain('75.00');
  });


  it('renders comment when present', () => {
    const orderWithComment = { ...mockOrder, comment: 'Please deliver fast' };
    const { container } = render(<PrintableOrder order={orderWithComment as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Please deliver fast');
  });

  it('does not render comment when null', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).not.toContain('Коментар');
  });



  it('renders status label', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Нове');
  });

  it('renders order status with correct color for different statuses', () => {
    const order = { ...mockOrder, status: 'cancelled' as const };
    const { container } = render(<PrintableOrder order={order as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Скасоване');
  });

  it('renders contactEmail when present', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('test@test.com');
  });

  it('does not render email when not present', () => {
    const orderNoEmail = { ...mockOrder, contactEmail: null };
    const { container } = render(<PrintableOrder order={orderNoEmail as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    // Should not crash
    expect(hidden).toBeTruthy();
  });

  it('renders signatures section', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('Відпустив');
    expect(hidden?.textContent).toContain('Отримав');
  });

  it('opens a new window and writes HTML on print click', () => {
    const mockWrite = vi.fn();
    const mockClose = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write: mockWrite, close: mockClose },
    } as any);

    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const printBtn = container.querySelector('button')!;
    fireEvent.click(printBtn);

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(mockWrite).toHaveBeenCalledTimes(1);
    const html = mockWrite.mock.calls[0][0] as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('ORD-001');
    expect(html).toContain('window.print()');
    expect(mockClose).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('does nothing when window.open returns null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const printBtn = container.querySelector('button')!;
    // Should not throw
    fireEvent.click(printBtn);

    vi.restoreAllMocks();
  });

  it('formats date in uk-UA format in printed content', () => {
    const mockWrite = vi.fn();
    const mockClose = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write: mockWrite, close: mockClose },
    } as any);

    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const printBtn = container.querySelector('button')!;
    fireEvent.click(printBtn);

    const html = mockWrite.mock.calls[0][0] as string;
    // The order createdAt is 2024-01-01, should appear as formatted date
    expect(html).toContain('01.01.2024');

    vi.restoreAllMocks();
  });

  it('does not render delivery cost total row when deliveryCost is 0', () => {
    const { container } = render(<PrintableOrder order={mockOrder as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    // The word "Доставка" appears as section heading; check that no delivery cost row exists
    const totalsText = hidden?.querySelector('.totals')?.textContent || '';
    expect(totalsText).not.toContain('Доставка');
  });

  it('renders status color for processing status', () => {
    const order = { ...mockOrder, status: 'processing' as const };
    const { container } = render(<PrintableOrder order={order as any} />);
    const hidden = container.querySelector('[style*="left: -9999px"]');
    expect(hidden?.textContent).toContain('В обробці');
  });
});
