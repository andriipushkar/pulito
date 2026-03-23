import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('initTelemetry', () => {
  it('does nothing when OTEL_EXPORTER_OTLP_ENDPOINT is not set', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
    const { initTelemetry } = await import('./telemetry');
    // Should not throw
    await expect(initTelemetry()).resolves.toBeUndefined();
  });

  it('handles missing OpenTelemetry packages gracefully', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318');
    const { initTelemetry } = await import('./telemetry');
    // Dynamic imports will fail in test env (no otel packages), but should not throw
    await expect(initTelemetry()).resolves.toBeUndefined();
  });
});

describe('createSpan', () => {
  it('executes function directly when OTEL is not configured', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
    const { createSpan } = await import('./telemetry');
    const fn = vi.fn().mockReturnValue('result');
    const result = await createSpan('test-span', fn);
    expect(fn).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  it('executes async function directly when OTEL is not configured', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
    const { createSpan } = await import('./telemetry');
    const result = await createSpan('test-span', async () => 42);
    expect(result).toBe(42);
  });

  it('propagates errors from the wrapped function', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', '');
    const { createSpan } = await import('./telemetry');
    await expect(
      createSpan('test-span', () => {
        throw new Error('span error');
      })
    ).rejects.toThrow('span error');
  });

  it('falls back to direct execution when otel import fails', async () => {
    vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318');
    const { createSpan } = await import('./telemetry');
    // Import of @opentelemetry/api will fail in test env
    const result = await createSpan('test', () => 'fallback');
    expect(result).toBe('fallback');
  });
});
