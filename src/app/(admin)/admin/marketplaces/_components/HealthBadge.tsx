import type { HealthStatus } from '../_shared';

export function HealthBadge({ health, enabled }: { health: HealthStatus | null; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Вимкнено
      </span>
    );
  }
  if (!health) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Не перевірено
      </span>
    );
  }
  if (health.status === 'ok') {
    return (
      <span
        title={health.accountName || 'Підключено'}
        className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Онлайн ({health.latencyMs} мс)
      </span>
    );
  }
  if (health.status === 'error') {
    return (
      <span
        title={health.error || 'Помилка'}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Помилка
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Не налаштовано
    </span>
  );
}
