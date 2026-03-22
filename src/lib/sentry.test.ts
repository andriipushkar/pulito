import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sentry (no DSN)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SENTRY_DSN = '';
    process.env.SENTRY_DSN = '';
  });

  it('captureException does not throw when Sentry is not configured', async () => {
    const { captureException } = await import('./sentry');
    await expect(captureException(new Error('test'))).resolves.toBeUndefined();
  });

  it('captureMessage does not throw when Sentry is not configured', async () => {
    const { captureMessage } = await import('./sentry');
    await expect(captureMessage('test msg')).resolves.toBeUndefined();
  });

  it('setUser does not throw when Sentry is not configured', async () => {
    const { setUser } = await import('./sentry');
    await expect(setUser({ id: '1' })).resolves.toBeUndefined();
  });
});

describe('sentry (with DSN)', () => {
  const mockCaptureException = vi.fn();
  const mockCaptureMessage = vi.fn();
  const mockSetUser = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.SENTRY_DSN = '';
  });

  it('captureException calls sentry when DSN is set', async () => {
    vi.doMock('@sentry/nextjs', () => ({
      captureException: mockCaptureException,
      captureMessage: mockCaptureMessage,
      setUser: mockSetUser,
    }));

    const { captureException } = await import('./sentry');
    const error = new Error('test error');
    await captureException(error);
    expect(mockCaptureException).toHaveBeenCalledWith(error, undefined);
  });

  it('captureMessage calls sentry when DSN is set', async () => {
    vi.doMock('@sentry/nextjs', () => ({
      captureException: mockCaptureException,
      captureMessage: mockCaptureMessage,
      setUser: mockSetUser,
    }));

    const { captureMessage } = await import('./sentry');
    await captureMessage('hello');
    expect(mockCaptureMessage).toHaveBeenCalledWith('hello');
  });

  it('setUser calls sentry when DSN is set', async () => {
    vi.doMock('@sentry/nextjs', () => ({
      captureException: mockCaptureException,
      captureMessage: mockCaptureMessage,
      setUser: mockSetUser,
    }));

    const { setUser } = await import('./sentry');
    await setUser({ id: '1', email: 'a@b.com' });
    expect(mockSetUser).toHaveBeenCalledWith({ id: '1', email: 'a@b.com' });
  });

  it('handles sentry import failure gracefully', async () => {
    vi.doMock('@sentry/nextjs', () => {
      throw new Error('module not found');
    });

    const { captureException } = await import('./sentry');
    await expect(captureException(new Error('test'))).resolves.toBeUndefined();
  });

  it('ensureInit is called only once (idempotent)', async () => {
    vi.doMock('@sentry/nextjs', () => ({
      captureException: mockCaptureException,
      captureMessage: mockCaptureMessage,
      setUser: mockSetUser,
    }));

    const mod = await import('./sentry');
    await mod.captureException(new Error('first'));
    await mod.captureMessage('second');
    // Both should work, sentry loaded once
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
  });

  it('setUser with null clears user', async () => {
    vi.doMock('@sentry/nextjs', () => ({
      captureException: mockCaptureException,
      captureMessage: mockCaptureMessage,
      setUser: mockSetUser,
    }));

    const { setUser } = await import('./sentry');
    await setUser(null);
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it('loadSentry skips re-import when sentryModule is already loaded', async () => {
    let importCount = 0;
    vi.doMock('@sentry/nextjs', () => {
      importCount++;
      return {
        captureException: mockCaptureException,
        captureMessage: mockCaptureMessage,
        setUser: mockSetUser,
      };
    });

    const mod = await import('./sentry');
    // First call triggers loadSentry which imports the module
    await mod.captureException(new Error('first'));
    expect(importCount).toBe(1);

    // Reset modules but keep the same module reference (no vi.resetModules)
    // Second call should hit `if (sentryModule) return;` branch
    await mod.captureMessage('second');
    // The import count should still be 1 since sentryModule is already set
    expect(importCount).toBe(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith('second');
  });
});
