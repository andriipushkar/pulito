/**
 * OpenTelemetry instrumentation setup.
 * Provides distributed tracing for API requests, DB queries, and Redis calls.
 *
 * To enable: set OTEL_EXPORTER_OTLP_ENDPOINT in env (e.g., http://localhost:4318)
 * Exports to: Jaeger, Grafana Tempo, or any OTLP-compatible backend.
 */

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let initialized = false;

export async function initTelemetry() {
  if (initialized || !OTEL_ENDPOINT) return;
  initialized = true;

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = await import('@opentelemetry/resources');

    const sdk = new NodeSDK({
      resource: new Resource({
        'service.name': 'clean-shop',
        'service.version': process.env.npm_package_version || '1.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter: new OTLPTraceExporter({ url: `${OTEL_ENDPOINT}/v1/traces` }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-fetch': { enabled: true },
        }),
      ],
    });

    sdk.start();

    process.on('SIGTERM', () => {
      sdk.shutdown().catch(console.error);
    });
  } catch {
    // OpenTelemetry packages not installed — skip silently
  }
}

/**
 * Create a manual span for custom instrumentation.
 * Falls back to no-op if OTEL is not configured.
 */
export async function createSpan<T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<T> {
  if (!OTEL_ENDPOINT) return fn();

  try {
    const { trace } = await import('@opentelemetry/api');
    const tracer = trace.getTracer('clean-shop');
    return tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  } catch {
    return fn();
  }
}
