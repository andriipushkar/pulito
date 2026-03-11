import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendOrderConfirmation,
  sendOrderStatusChanged,
  sendWelcomeEmail,
  sendWholesaleApproved,
  sendWholesaleRejected,
  sendDigestEmail,
  sendCartAbandonmentEmail,
} from './email-template';

const mockSendEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('./email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/config/env', () => ({
  env: {
    APP_URL: 'http://localhost:3000',
  },
}));

const mockFindUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailTemplate: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue(null);
});

describe('sendOrderConfirmation', () => {
  it('should send email with correct subject and content', async () => {
    await sendOrderConfirmation({
      to: 'user@test.com',
      name: 'Іван',
      orderNumber: 'ORD-001',
      items: [{ name: 'Засіб для миття', quantity: 2, price: 150 }],
      total: 300,
      deliveryMethod: 'Нова Пошта',
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe('user@test.com');
    expect(call.subject).toContain('ORD-001');
    expect(call.html).toContain('Іван');
    expect(call.html).toContain('ORD-001');
    expect(call.html).toContain('Засіб для миття');
    expect(call.html).toContain('300.00 ₴');
    expect(call.html).toContain('Нова Пошта');
  });

  it('should include all items in email', async () => {
    await sendOrderConfirmation({
      to: 'user@test.com',
      name: 'Тест',
      orderNumber: 'ORD-002',
      items: [
        { name: 'Item A', quantity: 1, price: 100 },
        { name: 'Item B', quantity: 3, price: 50 },
      ],
      total: 250,
      deliveryMethod: 'Самовивіз',
    });

    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain('Item A');
    expect(html).toContain('Item B');
  });
});

describe('sendOrderStatusChanged', () => {
  it('should send status change email', async () => {
    await sendOrderStatusChanged({
      to: 'user@test.com',
      name: 'Олена',
      orderNumber: 'ORD-003',
      newStatus: 'Відправлене',
      orderId: 42,
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toContain('ORD-003');
    expect(call.subject).toContain('Відправлене');
    expect(call.html).toContain('Відправлене');
    expect(call.html).toContain('/account/orders/42');
  });

  it('should include tracking number when provided', async () => {
    await sendOrderStatusChanged({
      to: 'user@test.com',
      name: 'Тест',
      orderNumber: 'ORD-004',
      newStatus: 'Відправлене',
      trackingNumber: '20450000001234',
      orderId: 1,
    });

    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain('20450000001234');
  });

  it('should include comment when provided', async () => {
    await sendOrderStatusChanged({
      to: 'user@test.com',
      name: 'Тест',
      orderNumber: 'ORD-005',
      newStatus: 'В обробці',
      comment: 'Чекаємо оплату',
      orderId: 2,
    });

    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain('Чекаємо оплату');
  });
});

describe('sendWelcomeEmail', () => {
  it('should send welcome email with name', async () => {
    await sendWelcomeEmail({ to: 'new@test.com', name: 'Марія' });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe('new@test.com');
    expect(call.subject).toContain('Ласкаво просимо');
    expect(call.html).toContain('Марія');
    expect(call.html).toContain('/catalog');
  });
});

describe('sendWholesaleApproved', () => {
  it('should send wholesale approval email', async () => {
    await sendWholesaleApproved({
      to: 'company@test.com',
      companyName: 'ТОВ Клін',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toContain('Оптовий статус');
    expect(call.html).toContain('ТОВ Клін');
  });

  it('should include manager info when provided', async () => {
    await sendWholesaleApproved({
      to: 'company@test.com',
      companyName: 'ТОВ Клін',
      managerName: 'Олексій Менеджер',
      managerPhone: '+380991234567',
    });

    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain('Олексій Менеджер');
    expect(html).toContain('+380991234567');
  });

  it('should include manager name without phone', async () => {
    await sendWholesaleApproved({
      to: 'company@test.com',
      companyName: 'ТОВ Клін',
      managerName: 'Олексій Менеджер',
    });

    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain('Олексій Менеджер');
    // Should not contain tel: link
    expect(html).not.toContain('tel:');
  });
});

describe('sendWholesaleRejected', () => {
  it('should send rejection email with reason', async () => {
    await sendWholesaleRejected({
      to: 'company@test.com',
      companyName: 'ТОВ Тест',
      reason: 'Недостатньо документів',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe('company@test.com');
    expect(call.subject).toContain('відхилено');
    expect(call.html).toContain('ТОВ Тест');
    expect(call.html).toContain('Недостатньо документів');
    expect(call.html).toContain('/contact');
  });

  it('should use DB template when available', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'wholesale_rejected',
      isActive: true,
      subject: 'Відмова {company_name}',
      bodyHtml: '<p>Компанія {company_name}, причина: {reason}</p>',
    });

    await sendWholesaleRejected({
      to: 'company@test.com',
      companyName: 'ТОВ Тест',
      reason: 'Причина',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe('Відмова ТОВ Тест');
    expect(call.html).toContain('Компанія ТОВ Тест, причина: Причина');
  });
});

describe('sendDigestEmail', () => {
  it('should send digest with new products and promos', async () => {
    await sendDigestEmail({
      to: 'user@test.com',
      name: 'Тест',
      newProducts: [{ name: 'New Product', price: 100, slug: 'new-product' }],
      promoProducts: [{ name: 'Promo', price: 80, oldPrice: 100, slug: 'promo' }],
      period: '01-07 березня',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe('user@test.com');
    expect(call.subject).toContain('Дайджест');
    expect(call.subject).toContain('01-07 березня');
    expect(call.html).toContain('Тест');
    expect(call.html).toContain('New Product');
    expect(call.html).toContain('100.00 ₴');
    expect(call.html).toContain('Promo');
    expect(call.html).toContain('80.00 ₴');
    expect(call.html).toContain('/product/new-product');
    expect(call.html).toContain('/product/promo');
  });

  it('should handle empty new products', async () => {
    await sendDigestEmail({
      to: 'user@test.com',
      name: 'Тест',
      newProducts: [],
      promoProducts: [{ name: 'Promo', price: 50, oldPrice: 100, slug: 'promo' }],
      period: 'week',
    });

    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).not.toContain('Нові товари');
    expect(html).toContain('Акційні пропозиції');
  });

  it('should handle empty promo products', async () => {
    await sendDigestEmail({
      to: 'user@test.com',
      name: 'Тест',
      newProducts: [{ name: 'New', price: 100, slug: 'new' }],
      promoProducts: [],
      period: 'week',
    });

    const html = mockSendEmail.mock.calls[0][0].html;
    expect(html).toContain('Нові товари');
    expect(html).not.toContain('Акційні пропозиції');
  });

  it('should use DB template when available', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'digest',
      isActive: true,
      subject: 'Дайджест {period}',
      bodyHtml: '<p>{name}, ось новинки:</p>',
    });

    await sendDigestEmail({
      to: 'user@test.com',
      name: 'Олена',
      newProducts: [],
      promoProducts: [],
      period: 'тиждень',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe('Дайджест тиждень');
    expect(call.html).toContain('Олена, ось новинки:');
  });
});

describe('sendCartAbandonmentEmail', () => {
  it('should send cart abandonment email', async () => {
    await sendCartAbandonmentEmail({
      to: 'user@test.com',
      name: 'Іван',
      items: [
        { name: 'Product A', quantity: 2, price: 100 },
        { name: 'Product B', quantity: 1, price: 50 },
      ],
      cartUrl: 'http://localhost:3000/cart',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe('user@test.com');
    expect(call.subject).toContain('кошику');
    expect(call.html).toContain('Іван');
    expect(call.html).toContain('Product A');
    expect(call.html).toContain('Product B');
    expect(call.html).toContain('200.00 ₴');
    expect(call.html).toContain('250.00 ₴'); // total
    expect(call.html).toContain('http://localhost:3000/cart');
  });

  it('should use DB template when available', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'cart_abandonment',
      isActive: true,
      subject: 'Кошик {name}',
      bodyHtml: '<p>{name}, сума: {total} ₴</p>',
    });

    await sendCartAbandonmentEmail({
      to: 'user@test.com',
      name: 'Олена',
      items: [{ name: 'P', quantity: 1, price: 100 }],
      cartUrl: 'http://localhost:3000/cart',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe('Кошик Олена');
    expect(call.html).toContain('Олена, сума: 100.00 ₴');
  });
});

describe('DB template rendering', () => {
  it('sendOrderConfirmation should use DB template when active', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'order_confirmation',
      isActive: true,
      subject: 'Замовлення #{order_number}',
      bodyHtml: '<p>{name}, ваше замовлення #{order_number} на {total} ₴</p>',
    });

    await sendOrderConfirmation({
      to: 'user@test.com',
      name: 'Тест',
      orderNumber: 'ORD-100',
      items: [{ name: 'Item', quantity: 1, price: 50 }],
      total: 50,
      deliveryMethod: 'НП',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe('Замовлення #ORD-100');
    expect(call.html).toContain('Тест, ваше замовлення #ORD-100 на 50.00 ₴');
  });

  it('sendOrderStatusChanged should use DB template when active', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'order_status_changed',
      isActive: true,
      subject: 'Статус #{order_number}: {new_status}',
      bodyHtml: '<p>{name}, замовлення #{order_number} — {new_status}</p>',
    });

    await sendOrderStatusChanged({
      to: 'user@test.com',
      name: 'Олена',
      orderNumber: 'ORD-200',
      newStatus: 'Доставлено',
      orderId: 10,
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe('Статус #ORD-200: Доставлено');
  });

  it('sendWelcomeEmail should use DB template when active', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'welcome',
      isActive: true,
      subject: 'Вітаємо, {name}!',
      bodyHtml: '<p>{name}, ласкаво просимо!</p>',
    });

    await sendWelcomeEmail({ to: 'new@test.com', name: 'Марія' });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe('Вітаємо, Марія!');
    expect(call.html).toContain('Марія, ласкаво просимо!');
  });

  it('sendWholesaleApproved should use DB template when active', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'wholesale_approved',
      isActive: true,
      subject: 'Оптовий доступ для {company_name}',
      bodyHtml: '<p>{company_name} підтверджено</p>',
    });

    await sendWholesaleApproved({
      to: 'company@test.com',
      companyName: 'ТОВ Клін',
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe('Оптовий доступ для ТОВ Клін');
  });

  it('should return null for inactive DB template', async () => {
    mockFindUnique.mockResolvedValueOnce({
      templateKey: 'welcome',
      isActive: false,
      subject: 'Should not use',
      bodyHtml: 'Should not use',
    });

    await sendWelcomeEmail({ to: 'new@test.com', name: 'Test' });

    const call = mockSendEmail.mock.calls[0][0];
    // Should fall back to hardcoded template
    expect(call.subject).toContain('Ласкаво просимо');
  });

  it('should fall back on DB template fetch error', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB error'));

    await sendWelcomeEmail({ to: 'new@test.com', name: 'Test' });

    const call = mockSendEmail.mock.calls[0][0];
    // Should fall back to hardcoded template
    expect(call.subject).toContain('Ласкаво просимо');
  });
});
