import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Capture 100% of errors in payment flows
    beforeSend(event) {
      // Tag payment errors for alerting
      const message = event.message || event.exception?.values?.[0]?.value || '';
      if (message.includes('payment') || message.includes('liqpay') || message.includes('monobank') || message.includes('wayforpay')) {
        event.tags = { ...event.tags, payment_error: 'true' };
        event.level = 'fatal';
      }
      return event;
    },
  });
}

export {};
