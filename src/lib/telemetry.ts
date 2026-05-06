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
    // OpenTelemetry packages are optional — load via string interop so type-check
    // succeeds without the @opentelemetry/* devDependencies installed.
    const load = (m: string) =>
      import(/* webpackIgnore: true */ m) as Promise<Record<string, unknown>>;
    const sdkNode = await load('@opentelemetry/sdk-node');
    const autoInstr = await load('@opentelemetry/auto-instrumentations-node');
    const otlpHttp = await load('@opentelemetry/exporter-trace-otlp-http');
    const resources = await load('@opentelemetry/resources');

    const NodeSDK = sdkNode.NodeSDK as new (config: unknown) => {
      start: () => void;
      shutdown: () => Promise<void>;
    };
    const getNodeAutoInstrumentations = autoInstr.getNodeAutoInstrumentations as (
      opts: unknown,
    ) => unknown;
    const OTLPTraceExporter = otlpHttp.OTLPTraceExporter as new (config: unknown) => unknown;
    const Resource = resources.Resource as new (attrs: Record<string, unknown>) => unknown;

    const sdk = new NodeSDK({
      resource: new Resource({
        'service.name': 'pulito',
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
export async function createSpan<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
  if (!OTEL_ENDPOINT) return fn();

  try {
    const load = (m: string) =>
      import(/* webpackIgnore: true */ m) as Promise<Record<string, unknown>>;
    const api = await load('@opentelemetry/api');
    const trace = api.trace as {
      getTracer: (n: string) => {
        startActiveSpan: <R>(
          n: string,
          fn: (s: {
            setStatus: (x: { code: number; message?: string }) => void;
            end: () => void;
          }) => R,
        ) => R;
      };
    };
    const tracer = trace.getTracer('pulito');
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
