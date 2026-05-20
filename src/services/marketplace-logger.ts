import { logger } from '@/lib/logger';

/**
 * Thin facade around the structured logger that auto-tags every entry with
 * `platform` and a `module` prefix, so Axiom queries can filter cleanly
 * (e.g. `module = "marketplace.sync" and level = "error"`).
 */
export function marketplaceLogger(
  module: string,
  defaults: Record<string, unknown> = {},
) {
  const ctx = { module: `marketplace.${module}`, ...defaults };
  return {
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(message, { ...ctx, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message, { ...ctx, ...meta }),
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(message, { ...ctx, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, { ...ctx, ...meta }),
  };
}

export type MarketplaceLogger = ReturnType<typeof marketplaceLogger>;
