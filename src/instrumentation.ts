import * as Sentry from '@sentry/nextjs';

// Report errors thrown in route handlers / nested RSCs to Sentry. Without this
// export (and the sentry.server.config import in register() below), the entire
// SERVER error surface was never captured even though SENTRY_DSN is set.
export const onRequestError = Sentry.captureRequestError;

// Next.js instrumentation hook — runs once when the server process boots.
// We use it to apply runtime-configurable settings that live in the DB so a
// fresh process picks them up without waiting for an admin to re-save.
export async function register(): Promise<void> {
  // The dynamic imports MUST stay inside this exact `=== 'nodejs'` guard:
  // Next replaces process.env.NEXT_RUNTIME per bundle, so the whole block is
  // dead-code-eliminated from the Edge bundle. Without it, ioredis (pulled in
  // via @/services/settings) tries to resolve Node's `net` module on Edge and
  // the build fails.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialise the Sentry server SDK (the config file runs Sentry.init).
    await import('../sentry.server.config');
    try {
      const { getSettings } = await import('@/services/settings');
      const { setLogLevel } = await import('@/lib/logger');
      const settings = await getSettings();
      if (settings.log_level) setLogLevel(settings.log_level);
    } catch {
      // Non-fatal: logger keeps the env-seeded level if settings can't be read.
    }
  }
}
