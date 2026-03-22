const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

interface SentryLike {
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (message: string) => void;
  setUser: (user: { id: string; email?: string } | null) => void;
  startSpan?: (options: { name: string; op: string }, callback: (span: unknown) => unknown) => unknown;
  withScope?: (callback: (scope: unknown) => void) => void;
}

let sentryModule: SentryLike | null = null;
let initPromise: Promise<void> | null = null;

async function loadSentry() {
  if (!DSN) return;
  if (sentryModule) return;
  try {
    // Use a variable so the bundler cannot statically resolve the module
    const pkg = '@sentry' + '/nextjs';
    sentryModule = await import(/* webpackIgnore: true */ pkg);
  } catch {
    // @sentry/nextjs not installed — silently ignore
  }
}

function ensureInit() {
  if (!initPromise) {
    initPromise = loadSentry();
  }
  return initPromise;
}

export async function captureException(error: unknown, context?: Record<string, unknown>) {
  await ensureInit();
  sentryModule?.captureException(error, context);
}

export async function captureMessage(message: string) {
  await ensureInit();
  sentryModule?.captureMessage(message);
}

export async function setUser(user: { id: string; email?: string } | null) {
  await ensureInit();
  sentryModule?.setUser(user);
}

/**
 * Wrap a function in a Sentry performance span.
 * Falls back to direct execution if Sentry is not available.
 */
export async function withSpan<T>(
  name: string,
  op: string,
  fn: () => T | Promise<T>
): Promise<T> {
  await ensureInit();
  if (sentryModule?.startSpan) {
    return sentryModule.startSpan({ name, op }, () => fn()) as T;
  }
  return fn();
}

/**
 * Wrap a function with Sentry scope for additional context.
 */
export async function withSentryScope(
  callback: (setTag: (key: string, value: string) => void) => void
): Promise<void> {
  await ensureInit();
  if (sentryModule?.withScope) {
    sentryModule.withScope((scope: any) => {
      callback((key: string, value: string) => scope.setTag(key, value));
    });
  }
}
