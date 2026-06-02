'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface Webhook {
  id: number;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  deliveries: { statusCode: number | null; createdAt: string | Date; error: string | null }[];
}

const AVAILABLE_EVENTS = [
  'order.created',
  'order.status_changed',
  'payment.received',
  'stock.low',
] as const;

export default function WebhooksPage() {
  const t = useTranslations('admin.webhooksPage');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState({ name: '', url: '', events: [] as string[] });
  // Reload via token bump; fetch lives in the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const fetchAll = async () => {
    setReloadToken((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    apiClient.get<Webhook[]>('/api/v1/admin/webhooks').then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setWebhooks(res.data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const create = async () => {
    if (!draft.name || !draft.url) {
      toast.error(t('validateError'));
      return;
    }
    const res = await apiClient.post('/api/v1/admin/webhooks', draft);
    if (res.success) {
      toast.success(t('createdToast'));
      setDraft({ name: '', url: '', events: [] });
      fetchAll();
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/webhooks/${id}`, { isActive });
    if (!res.success) toast.error(res.error || t('updateError'));
    fetchAll();
  };

  const remove = async (id: number) => {
    if (!confirm(t('deleteConfirm'))) return;
    const res = await apiClient.delete(`/api/v1/admin/webhooks/${id}`);
    if (!res.success) toast.error(res.error || t('deleteError'));
    fetchAll();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">{t('intro')}</p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-2 text-sm font-semibold">{t('createSection')}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label={t('nameLabel')}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t('namePlaceholder')}
          />
          <Input
            label={t('urlLabel')}
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder={t('urlPlaceholder')}
          />
        </div>
        <p className="mt-3 mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {t('events')}
        </p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_EVENTS.map((ev) => {
            const active = draft.events.includes(ev);
            return (
              <button
                key={ev}
                onClick={() =>
                  setDraft({
                    ...draft,
                    events: active ? draft.events.filter((e) => e !== ev) : [...draft.events, ev],
                  })
                }
                className={`rounded-full px-3 py-1 text-xs font-mono ${
                  active
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
                }`}
              >
                {ev}
              </button>
            );
          })}
        </div>
        <Button size="sm" className="mt-3" onClick={create}>
          {t('create')}
        </Button>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
          {t('loading')}
        </p>
      ) : webhooks.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => {
            const last = wh.deliveries[0];
            const lastOk = last && last.statusCode !== null && last.statusCode < 400;
            return (
              <div
                key={wh.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{wh.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          wh.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {wh.isActive ? t('statusActive') : t('statusInactive')}
                      </span>
                    </div>
                    <p className="truncate font-mono text-xs text-[var(--color-text-secondary)]">
                      {wh.url}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
                      {wh.events.map((e) => (
                        <span
                          key={e}
                          className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono"
                        >
                          {e}
                        </span>
                      ))}
                    </p>
                    {last && (
                      <p className={`mt-2 text-xs ${lastOk ? 'text-emerald-700' : 'text-red-700'}`}>
                        {t('lastAttempt')} {last.statusCode ?? 'error'}{' '}
                        {new Date(last.createdAt).toLocaleString('uk-UA')}
                        {last.error && ` — ${last.error}`}
                      </p>
                    )}
                    {/* The signing secret is shown once at creation only. The
                        list no longer returns it (it was encrypted ciphertext),
                        so the always-stale "show secret" panel is removed. */}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(wh.id, !wh.isActive)}
                    >
                      {wh.isActive ? t('disable') : t('enable')}
                    </Button>
                    <button
                      onClick={() => remove(wh.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
