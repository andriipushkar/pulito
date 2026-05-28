'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import {
  MARKETPLACES,
  formatRelative,
  type MarketplaceConfig,
  type MarketplaceStatus,
  type HealthStatus,
  type SyncType,
} from '../_shared';
import { HealthBadge } from './HealthBadge';
import { UptimeSparkline } from './UptimeSparkline';
import { WebhookUrlBlock } from './WebhookUrlBlock';
import { HelpTooltip } from './HelpTooltip';
import { AutoSyncSettings, syncTypeLabel } from './AutoSyncSettings';
import { AutoCrosslistSettings } from './AutoCrosslistSettings';

interface TokenExpiryInfo {
  platform: string;
  hasToken: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  health: 'unknown' | 'fresh' | 'warn' | 'critical' | 'expired' | 'no-token';
}

export function SettingsTab() {
  const t = useTranslations('admin.settingsTab');
  const tSync = useTranslations('admin.autoSyncSettings');
  const tShared = useTranslations('admin.marketplacesShared');
  const [configs, setConfigs] = useState<Record<string, MarketplaceConfig | null>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string | boolean>>>({});
  const [statuses, setStatuses] = useState<Record<string, MarketplaceStatus | null>>({});
  const [tokenExpiry, setTokenExpiry] = useState<Record<string, TokenExpiryInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, Set<string>>>({});

  // Reload via token bump from event handlers; fetch lives in the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const loadAll = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<Record<string, MarketplaceConfig | null>>('/api/v1/admin/channel-settings'),
      apiClient.get<MarketplaceStatus[]>('/api/v1/admin/marketplaces'),
      apiClient.get<TokenExpiryInfo[]>('/api/v1/admin/marketplaces/token-expiry'),
    ]).then(([configsRes, statusesRes, expiryRes]) => {
      if (cancelled) return;
      if (configsRes.success && configsRes.data) {
        const newForms: Record<string, Record<string, string | boolean>> = {};
        const newDirty: Record<string, Set<string>> = {};
        for (const m of MARKETPLACES) {
          const config = configsRes.data[m.key] as MarketplaceConfig | null;
          if (config) {
            newForms[m.key] = { ...config };
          } else {
            const empty: Record<string, string | boolean> = { enabled: false };
            m.fields.forEach((f) => {
              empty[f.key] = '';
            });
            newForms[m.key] = empty;
          }
          newDirty[m.key] = new Set();
        }
        setConfigs(configsRes.data);
        setForms(newForms);
        setDirty(newDirty);
      }

      if (statusesRes.success && statusesRes.data) {
        const map: Record<string, MarketplaceStatus> = {};
        for (const s of statusesRes.data) map[s.platform] = s;
        setStatuses(map);
      }

      if (expiryRes.success && Array.isArray(expiryRes.data)) {
        const map: Record<string, TokenExpiryInfo> = {};
        for (const e of expiryRes.data) map[e.platform] = e;
        setTokenExpiry(map);
      }

      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const updateField = (marketplace: string, field: string, value: string | boolean) => {
    setForms((prev) => ({ ...prev, [marketplace]: { ...prev[marketplace], [field]: value } }));
    setDirty((prev) => {
      const s = new Set(prev[marketplace] || []);
      s.add(field);
      return { ...prev, [marketplace]: s };
    });
  };

  // Boolean toggles that live OUTSIDE the marketplace.fields[] array (they
  // have a bespoke UI — checkbox, not <Input>). Centralised here so a future
  // dev adding "auto-translate" or similar doesn't have to remember to insert
  // a new `if (dirty.has('newKey'))` branch in buildConfigBody.
  const EXTRA_BOOLEAN_KEYS = ['sandboxMode'] as const;

  const buildConfigBody = (marketplace: (typeof MARKETPLACES)[number]) => {
    const ch = marketplace.key;
    const config: Record<string, string | boolean> = { enabled: forms[ch]?.enabled ?? false };
    for (const f of marketplace.fields) {
      if (dirty[ch]?.has(f.key)) {
        config[f.key] = forms[ch]?.[f.key] ?? '';
      } else if (configs[ch]?.[f.key] !== undefined) {
        const existing = configs[ch]![f.key];
        if (typeof existing === 'string' && existing.includes('•')) continue;
        config[f.key] = existing!;
      }
    }
    for (const key of EXTRA_BOOLEAN_KEYS) {
      if (dirty[ch]?.has(key)) {
        config[key] = forms[ch]?.[key] === true;
      }
    }
    return config;
  };

  const handleSave = async (marketplace: (typeof MARKETPLACES)[number]) => {
    const ch = marketplace.key;

    // Catch the silent footgun: user clicked "Змінити" on a masked credential,
    // didn't type anything, and is about to overwrite a working integration
    // with an empty string. Confirm explicitly before saving — once accepted,
    // the save proceeds; cancel keeps the credential intact (user can refresh
    // to restore the masked display).
    const clearedSensitive = marketplace.fields.filter((f) => {
      if (!f.sensitive) return false;
      if (!dirty[ch]?.has(f.key)) return false;
      const current = forms[ch]?.[f.key];
      if (typeof current !== 'string' || current.length > 0) return false;
      // Was there a previously-saved value? Stored sensitive values come back
      // masked with bullets (`••••`), so any non-empty `configs` value counts
      // as "had a credential here".
      const stored = configs[ch]?.[f.key];
      return typeof stored === 'string' && stored.length > 0;
    });

    if (clearedSensitive.length > 0) {
      const fieldLabels = clearedSensitive.map((f) => tShared(f.label)).join(', ');
      const ok = window.confirm(t('confirmEmpty', { fields: fieldLabels, name: marketplace.name }));
      if (!ok) return;
    }

    setSaving((prev) => ({ ...prev, [ch]: true }));
    const config = buildConfigBody(marketplace);
    const res = await apiClient.put('/api/v1/admin/channel-settings', { channel: ch, config });
    if (res.success) {
      toast.success(t('savedToast', { name: marketplace.name }));
      await loadAll();
    } else {
      toast.error(res.error || t('saveError'));
    }
    setSaving((prev) => ({ ...prev, [ch]: false }));
  };

  const handleTest = async (marketplace: (typeof MARKETPLACES)[number]) => {
    const ch = marketplace.key;
    setTesting((prev) => ({ ...prev, [ch]: true }));
    // Pass the current form values — backend merges with stored for any masked fields
    const config = { ...(forms[ch] || {}), enabled: true };
    const res = await apiClient.post<HealthStatus>(`/api/v1/admin/marketplaces/${ch}/test`, {
      config,
    });
    if (res.success && res.data) {
      const health = res.data;
      setStatuses((prev) => ({
        ...prev,
        [ch]: prev[ch]
          ? { ...prev[ch]!, health }
          : ({
              platform: ch,
              connected: true,
              publishedCount: 0,
              lastSyncProducts: null,
              lastSyncStock: null,
              lastSyncOrders: null,
              health,
            } as MarketplaceStatus),
      }));
      if (health.status === 'ok') {
        toast.success(
          t('connectedToast', {
            name: marketplace.name,
            suffix: health.accountName ? ` (${health.accountName})` : '',
          }),
        );
      } else {
        toast.error(
          t('testErrorToast', {
            name: marketplace.name,
            error: health.error || t('connectionError'),
          }),
        );
      }
    } else {
      toast.error(res.error || t('testError'));
    }
    setTesting((prev) => ({ ...prev, [ch]: false }));
  };

  const handleSync = async (marketplace: (typeof MARKETPLACES)[number], action: SyncType) => {
    const ch = marketplace.key;
    const key = `${ch}:${action}`;
    setSyncing((prev) => ({ ...prev, [key]: true }));
    const res = await apiClient.post<Record<string, number>>(`/api/v1/admin/marketplaces/${ch}`, {
      action,
    });
    if (res.success && res.data) {
      const parts = Object.entries(res.data)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      toast.success(`${marketplace.name} ${syncTypeLabel(tSync, action)} — ${parts}`);
      await loadAll();
    } else {
      toast.error(res.error || t('syncError'));
    }
    setSyncing((prev) => ({ ...prev, [key]: false }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {t.rich('introBanner', {
          b: (c) => <strong>{c}</strong>,
          link: (c) => (
            <Link href="/admin/marketplaces/help" className="font-semibold underline">
              {c}
            </Link>
          ),
          icon: () => (
            <span className="inline-block rounded-full border border-current px-1 text-[10px]">
              i
            </span>
          ),
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {MARKETPLACES.map((marketplace) => {
          const ch = marketplace.key;
          const form = forms[ch] || { enabled: false };
          const isEnabled = form.enabled === true;
          const status = statuses[ch];
          const health = status?.health || null;
          const hasCreds = marketplace.fields
            .filter((f) => !f.optional)
            .every((f) => {
              const val = form[f.key];
              return typeof val === 'string' && val.length > 0;
            });

          return (
            <div
              key={ch}
              className={`rounded-xl border p-5 transition-all ${
                isEnabled && health?.status === 'ok'
                  ? 'border-green-200 bg-[var(--color-bg)] shadow-sm'
                  : isEnabled && health?.status === 'error'
                    ? 'border-red-200 bg-[var(--color-bg)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{marketplace.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{marketplace.name}</h3>
                      <a
                        href={marketplace.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={tShared(marketplace.docsLabel)}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                          />
                        </svg>
                      </a>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {tShared(marketplace.description)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateField(ch, 'enabled', !isEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    isEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                  />
                </button>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-xs">
                <HealthBadge health={health} enabled={isEnabled} />
                {health && (
                  <span className="text-[var(--color-text-secondary)]">
                    {t('checkedLabel')} {formatRelative(tShared, health.checkedAt)}
                  </span>
                )}
                {status?.publishedCount ? (
                  <span className="text-[var(--color-text-secondary)]">
                    {t.rich('publishedLabel', {
                      count: status.publishedCount,
                      b: (c) => <strong>{c}</strong>,
                    })}
                  </span>
                ) : null}
                {tokenExpiry[ch] &&
                  tokenExpiry[ch].hasToken &&
                  tokenExpiry[ch].daysRemaining != null && (
                    <span
                      title={
                        tokenExpiry[ch].expiresAt
                          ? t('tokenValidUntil', {
                              date: new Date(tokenExpiry[ch].expiresAt!).toLocaleString('uk-UA'),
                            })
                          : ''
                      }
                      className={
                        tokenExpiry[ch].health === 'expired'
                          ? 'font-semibold text-red-600'
                          : tokenExpiry[ch].health === 'critical'
                            ? 'font-semibold text-red-600'
                            : tokenExpiry[ch].health === 'warn'
                              ? 'text-amber-700'
                              : 'text-[var(--color-text-secondary)]'
                      }
                    >
                      {tokenExpiry[ch].health === 'expired'
                        ? t('tokenExpired')
                        : t('tokenDaysLeft', { days: tokenExpiry[ch].daysRemaining! })}
                    </span>
                  )}
                {status?.rateUsage && (
                  <span
                    title={t('rateTitle', { limit: status.rateUsage.limit5min })}
                    className={`text-[var(--color-text-secondary)] ${
                      status.rateUsage.warning ? 'text-amber-700' : ''
                    }`}
                  >
                    {t('rateLabel', {
                      count: status.rateUsage.count,
                      limit: status.rateUsage.limit5min,
                    })}
                  </span>
                )}
              </div>

              {health?.status === 'error' && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <strong>{t('connErrorLabel')}</strong> {health.error}
                </div>
              )}

              <label className="mb-4 flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.sandboxMode === true}
                  onChange={(e) => updateField(ch, 'sandboxMode', e.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                <span>{t.rich('sandboxNote', { b: (c) => <strong>{c}</strong> })}</span>
              </label>

              <UptimeSparkline platform={ch} />
              <WebhookUrlBlock platform={ch} />

              <div className="space-y-3">
                {marketplace.fields.map((field) => {
                  const tokenKey = `${ch}_${field.key}`;
                  const isShown = showTokens[tokenKey];
                  const help = 'help' in field ? (field as { help?: string }).help : undefined;
                  const currentValue = String(form[field.key] || '');
                  const isDirty = dirty[ch]?.has(field.key);
                  // For sensitive fields with an existing masked value we hide
                  // the input behind a "Change" button — prevents accidental
                  // clearing of credentials. Click to enter a new value.
                  const isMasked = field.sensitive && currentValue.includes('•') && !isDirty;
                  return (
                    <div key={field.key}>
                      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                        {tShared(field.label)} {field.optional && <span>{t('optional')}</span>}
                        {help && <HelpTooltip text={tShared(help)} />}
                      </label>
                      {isMasked ? (
                        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs">
                          <span className="font-mono text-[var(--color-text-secondary)]">
                            {currentValue}
                          </span>
                          <span className="text-[10px] text-green-600">{t('savedInline')}</span>
                          <button
                            type="button"
                            onClick={() => updateField(ch, field.key, '')}
                            className="ml-auto text-[var(--color-primary)] hover:underline"
                            title={t('clearFieldTitle')}
                          >
                            {t('change')}
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            type={field.sensitive && !isShown ? 'password' : 'text'}
                            value={currentValue}
                            onChange={(e) => updateField(ch, field.key, e.target.value)}
                            placeholder={tShared(field.placeholder)}
                          />
                          {field.sensitive && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowTokens((prev) => ({ ...prev, [tokenKey]: !isShown }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs text-[var(--color-text-secondary)]"
                            >
                              {isShown ? '🙈' : '👁️'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSave(marketplace)}
                  disabled={saving[ch] || !dirty[ch]?.size}
                >
                  {saving[ch] ? t('saving') : t('save')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest(marketplace)}
                  disabled={testing[ch] || !hasCreds}
                  isLoading={testing[ch]}
                  title={hasCreds ? t('testTitle') : t('fillRequired')}
                >
                  {t('testBtn')}
                </Button>
                {ch === 'olx' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const res = await apiClient.post<{ expiresIn?: number }>(
                        '/api/v1/admin/marketplaces/olx/refresh-token',
                      );
                      if (res.success) {
                        const exp = res.data?.expiresIn
                          ? t('validForDays', { days: Math.floor(res.data.expiresIn / 86400) })
                          : '';
                        toast.success(t('olxTokenRefreshed', { exp }));
                        loadAll();
                      } else {
                        toast.error(res.error || t('tokenRefreshFailed'));
                      }
                    }}
                    title={t('refreshTokenTitle')}
                  >
                    {t('refreshTokenBtn')}
                  </Button>
                )}
              </div>

              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {t('manualSync')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['products', 'stock', 'orders'] as SyncType[]).map((type) => {
                    const supported = marketplace.supports[type];
                    const key = `${ch}:${type}`;
                    const lastSync =
                      type === 'products'
                        ? status?.lastSyncProducts
                        : type === 'stock'
                          ? status?.lastSyncStock
                          : status?.lastSyncOrders;
                    return (
                      <div key={type} className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            !supported || !isEnabled || syncing[key] || health?.status === 'error'
                          }
                          isLoading={syncing[key]}
                          onClick={() => handleSync(marketplace, type)}
                          title={
                            !supported
                              ? t('notSupportedByMp')
                              : !isEnabled
                                ? t('enableFirst')
                                : health?.status === 'error'
                                  ? t('fixConnFirst')
                                  : t('lastSyncTitle', { rel: formatRelative(tShared, lastSync) })
                          }
                        >
                          {syncTypeLabel(tSync, type)}
                        </Button>
                        {lastSync && supported && (
                          <span className="text-[10px] text-[var(--color-text-secondary)]">
                            {formatRelative(tShared, lastSync)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">🔄</span>
          <div>
            <h3 className="font-semibold">{t('autoSyncTitle')}</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('autoSyncDesc')}</p>
          </div>
        </div>
        <AutoSyncSettings />
      </div>

      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <div>
            <h3 className="font-semibold">Auto cross-listing</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('autoCrosslistDesc')}</p>
          </div>
        </div>
        <AutoCrosslistSettings />
      </div>
    </div>
  );
}
