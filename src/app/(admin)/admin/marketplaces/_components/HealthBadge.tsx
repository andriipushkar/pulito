'use client';

import { useTranslations } from 'next-intl';
import type { HealthStatus } from '../_shared';

/**
 * HealthBadge — status pill for a marketplace integration.
 *
 * Tailwind palette tweak: each tier uses bg-X-100 + dark:bg-X-900/30, so the
 * badge stays readable on both light and dark admin themes. The dot inside
 * keeps a saturated colour so the status is visible at a glance even when
 * the surrounding text is washed out by the theme.
 */
export function HealthBadge({
  health,
  enabled,
}: {
  health: HealthStatus | null;
  enabled: boolean;
}) {
  const t = useTranslations('admin.healthBadge');
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        {t('disabled')}
      </span>
    );
  }
  if (!health) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        {t('notChecked')}
      </span>
    );
  }
  if (health.status === 'ok') {
    return (
      <span
        title={health.accountName || t('connected')}
        className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        {t('online', { latency: health.latencyMs })}
      </span>
    );
  }
  if (health.status === 'error') {
    return (
      <span
        title={health.error || t('error')}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {t('error')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {t('notConfigured')}
    </span>
  );
}
