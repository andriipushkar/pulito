import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => {
  class MockQueue {
    name: string;
    opts: unknown;
    add = vi.fn();
    close = vi.fn();
    constructor(name: string, opts: unknown) {
      this.name = name;
      this.opts = opts;
    }
  }
  return { Queue: MockQueue };
});

// Reset module state between tests
beforeEach(() => {
  vi.resetModules();
});

describe('Queue factories', () => {
  it('creates email queue with correct config', async () => {
    const { getEmailQueue } = await import('./queues');
    const queue = getEmailQueue();

    expect(queue.name).toBe('email');
    expect((queue as any).opts.defaultJobOptions.attempts).toBe(3);
  });

  it('creates push queue with correct config', async () => {
    const { getPushQueue } = await import('./queues');
    const queue = getPushQueue();

    expect(queue.name).toBe('push');
    expect((queue as any).opts.defaultJobOptions.attempts).toBe(2);
  });

  it('creates pdf queue with correct config', async () => {
    const { getPdfQueue } = await import('./queues');
    const queue = getPdfQueue();

    expect(queue.name).toBe('pdf');
    expect((queue as any).opts.defaultJobOptions.attempts).toBe(2);
  });

  it('creates marketplace-sync queue with correct config', async () => {
    const { getMarketplaceSyncQueue } = await import('./queues');
    const queue = getMarketplaceSyncQueue();

    expect(queue.name).toBe('marketplace-sync');
    expect((queue as any).opts.defaultJobOptions.attempts).toBe(3);
  });

  it('returns singleton instance on repeated calls', async () => {
    const { getEmailQueue } = await import('./queues');
    const q1 = getEmailQueue();
    const q2 = getEmailQueue();

    expect(q1).toBe(q2);
  });
});
