import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Capture 100% of errors in payment flows
    beforeSend(event) {
      const message = event.message || event.exception?.values?.[0]?.value || '';

      // Drop benign streaming-abort noise. When a client (usually a bot/scraper
      // that doesn't read the full response) disconnects mid-SSR-stream, Node's
      // internal TransformStream tears down and Next surfaces
      // "transformAlgorithm is not a function" to onRequestError. Real users are
      // unaffected — the page renders fine; this only fires on aborted streams.
      if (
        message.includes('transformAlgorithm is not a function') ||
        message.includes('Invalid state: Controller is already closed') ||
        message.includes('The stream has been aborted')
      ) {
        return null;
      }

      // Tag payment errors for alerting
      if (
        message.includes('payment') ||
        message.includes('liqpay') ||
        message.includes('monobank') ||
        message.includes('wayforpay')
      ) {
        event.tags = { ...event.tags, payment_error: 'true' };
        event.level = 'fatal';
      }
      return event;
    },
  });
}

export {};
