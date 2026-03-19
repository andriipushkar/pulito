import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('outputs structured JSON for error level', () => {
    logger.error('Something failed', { orderId: 123 });

    expect(errorSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('error');
    expect(output.message).toBe('Something failed');
    expect(output.orderId).toBe(123);
    expect(output.timestamp).toBeDefined();
  });

  it('outputs structured JSON for warn level', () => {
    logger.warn('Low stock', { productId: 5 });

    expect(warnSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('warn');
    expect(output.message).toBe('Low stock');
    expect(output.productId).toBe(5);
  });

  it('outputs structured JSON for info level', () => {
    logger.info('Order created', { orderNumber: 'ORD-001' });

    expect(logSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('info');
    expect(output.message).toBe('Order created');
    expect(output.orderNumber).toBe('ORD-001');
  });

  it('includes ISO timestamp in every log', () => {
    logger.info('test');

    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('works without metadata', () => {
    logger.error('plain error');

    const output = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('error');
    expect(output.message).toBe('plain error');
  });

  it('spreads multiple metadata fields', () => {
    logger.info('payment', { orderId: 1, provider: 'liqpay', amount: 500 });

    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.orderId).toBe(1);
    expect(output.provider).toBe('liqpay');
    expect(output.amount).toBe(500);
  });
});
