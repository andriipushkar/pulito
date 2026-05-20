'use client';

import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { HelpTooltip } from './HelpTooltip';

// Subscribing via useSyncExternalStore reads window.location.origin during
// client render without an unconditional setState in an effect.
const subscribeNoop = () => () => {};
const getOriginClient = () => window.location.origin;
const getOriginServer = () => '';

export function WebhookUrlBlock({ platform }: { platform: string }) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(subscribeNoop, getOriginClient, getOriginServer);

  const url = `${origin}/api/webhooks/marketplaces/${platform}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не вдалося скопіювати');
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs">
      <div className="mb-1 flex items-center gap-1.5 text-[var(--color-text-secondary)]">
        <span>Webhook URL для маркетплейсу</span>
        <HelpTooltip text="Вставте цей URL у налаштування webhook у дашборді маркетплейсу. Подія типу 'нове замовлення' буде приходити сюди." />
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-[var(--color-bg)] px-2 py-1 font-mono text-[11px]">
          {url}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--color-bg)]"
        >
          {copied ? '✓ Скопійовано' : 'Копіювати'}
        </button>
      </div>
    </div>
  );
}
