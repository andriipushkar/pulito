'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// Маркетплейси (olx/rozetka/prom/epicentrk) керуються через /admin/marketplaces,
// тут лише соцмережі та месенджери — щоб не дублювати UI.
type ChannelKey = 'telegram' | 'facebook' | 'instagram' | 'tiktok';

interface ChannelField {
  key: string;
  label: string;
  placeholder: string;
  sensitive?: boolean;
  optional?: boolean;
}

interface ChannelDef {
  key: ChannelKey;
  name: string;
  icon: string;
  color: string;
  description: string;
  fields: ChannelField[];
}

const CHANNEL_KEYS: ChannelKey[] = ['telegram', 'facebook', 'instagram', 'tiktok'];

interface TestResult {
  success: boolean;
  name?: string;
  error?: string;
}

export default function ChannelSettingsPage() {
  const t = useTranslations('admin.channelSettingsPage');
  const CHANNELS: ChannelDef[] = useMemo(
    () => [
      {
        key: 'telegram',
        name: 'Telegram',
        icon: '✈️',
        color: '#0088cc',
        description: t('tgDesc'),
        fields: [
          {
            key: 'botToken',
            label: t('tgBotToken'),
            placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
            sensitive: true,
          },
          {
            key: 'channelId',
            label: t('tgChannelId'),
            placeholder: t('tgChannelIdPh'),
            optional: true,
          },
          {
            key: 'managerChatId',
            label: t('tgManagerChat'),
            placeholder: '123456789',
            optional: true,
          },
        ],
      },
      {
        key: 'facebook',
        name: 'Facebook',
        icon: '📘',
        color: '#1877f2',
        description: t('fbDesc'),
        fields: [
          {
            key: 'pageAccessToken',
            label: t('fbPageToken'),
            placeholder: 'EAAx...',
            sensitive: true,
          },
          { key: 'pageId', label: t('fbPageId'), placeholder: t('fbPageIdPh') },
        ],
      },
      {
        key: 'instagram',
        name: 'Instagram',
        icon: '📷',
        color: '#e4405f',
        description: t('igDesc'),
        fields: [
          { key: 'accessToken', label: t('igAccessToken'), placeholder: 'IGQ...', sensitive: true },
          { key: 'businessAccountId', label: t('igBusinessId'), placeholder: t('igBusinessIdPh') },
          { key: 'appId', label: t('igAppId'), placeholder: t('igAppIdPh'), optional: true },
          {
            key: 'appSecret',
            label: t('igAppSecret'),
            placeholder: t('igAppSecretPh'),
            sensitive: true,
            optional: true,
          },
        ],
      },
      {
        key: 'tiktok',
        name: 'TikTok',
        icon: '🎵',
        color: '#000000',
        description: t('tiktokDesc'),
        fields: [
          {
            key: 'accessToken',
            label: t('igAccessToken'),
            placeholder: t('tiktokAccessTokenPh'),
            sensitive: true,
          },
          { key: 'openId', label: t('tiktokOpenId'), placeholder: t('tiktokOpenIdPh') },
        ],
      },
    ],
    [t],
  );
  const [configs, setConfigs] = useState(() => {
    const o = {} as Record<ChannelKey, Record<string, string | boolean> | null>;
    CHANNEL_KEYS.forEach((k) => {
      o[k] = null;
    });
    return o;
  });
  const [forms, setForms] = useState(() => {
    const o = {} as Record<ChannelKey, Record<string, string | boolean>>;
    CHANNEL_KEYS.forEach((k) => {
      o[k] = { enabled: false };
    });
    return o;
  });
  const [dirty, setDirty] = useState(() => {
    const o = {} as Record<ChannelKey, Set<string>>;
    CHANNEL_KEYS.forEach((k) => {
      o[k] = new Set();
    });
    return o;
  });
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<ChannelKey, boolean>>(
    Object.fromEntries(CHANNEL_KEYS.map((k) => [k, false])) as Record<ChannelKey, boolean>,
  );
  const [testResults, setTestResults] = useState<Record<ChannelKey, TestResult | null>>(
    Object.fromEntries(CHANNEL_KEYS.map((k) => [k, null])) as Record<ChannelKey, TestResult | null>,
  );
  const [saving, setSaving] = useState<Record<ChannelKey, boolean>>(
    Object.fromEntries(CHANNEL_KEYS.map((k) => [k, false])) as Record<ChannelKey, boolean>,
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadConfigs = useCallback(async () => {
    const res = await apiClient.get<Record<ChannelKey, Record<string, string | boolean> | null>>(
      '/api/v1/admin/channel-settings',
    );
    if (res.success && res.data) {
      setConfigs(res.data);
      const newForms = { ...forms };
      for (const ch of CHANNELS) {
        if (res.data[ch.key]) {
          newForms[ch.key] = { ...res.data[ch.key]! };
        } else {
          const emptyForm: Record<string, string | boolean> = { enabled: false };
          ch.fields.forEach((f) => {
            emptyForm[f.key] = '';
          });
          newForms[ch.key] = emptyForm;
        }
      }
      setForms(newForms);
      setDirty(
        Object.fromEntries(CHANNEL_KEYS.map((k) => [k, new Set<string>()])) as Record<
          ChannelKey,
          Set<string>
        >,
      );
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const updateField = (channel: ChannelKey, field: string, value: string | boolean) => {
    setForms((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [field]: value },
    }));
    setDirty((prev) => {
      const s = new Set(prev[channel]);
      s.add(field);
      return { ...prev, [channel]: s };
    });
    setTestResults((prev) => ({ ...prev, [channel]: null }));
  };

  const handleTest = async (channelDef: ChannelDef) => {
    const ch = channelDef.key;
    setTesting((prev) => ({ ...prev, [ch]: true }));
    setTestResults((prev) => ({ ...prev, [ch]: null }));

    // Build config with real values: use form values for dirty fields, original for unchanged
    const config: Record<string, string | boolean> = { enabled: true };
    for (const f of channelDef.fields) {
      const val = dirty[ch].has(f.key) ? forms[ch][f.key] : configs[ch]?.[f.key];
      if (val !== undefined) config[f.key] = val;
    }

    const res = await apiClient.post<TestResult>('/api/v1/admin/channel-settings/test', {
      channel: ch,
      config,
    });

    setTestResults((prev) => ({
      ...prev,
      [ch]: res.success && res.data ? res.data : { success: false, error: t('requestError') },
    }));
    setTesting((prev) => ({ ...prev, [ch]: false }));
  };

  const handleSave = async (channelDef: ChannelDef) => {
    const ch = channelDef.key;
    setSaving((prev) => ({ ...prev, [ch]: true }));

    // Merge: for untouched sensitive fields, preserve original DB value
    const config: Record<string, string | boolean> = { enabled: forms[ch].enabled };
    for (const f of channelDef.fields) {
      if (dirty[ch].has(f.key)) {
        config[f.key] = forms[ch][f.key];
      } else if (configs[ch]?.[f.key] !== undefined) {
        // Field wasn't changed — tell backend to keep existing
        // If the value looks masked (starts with •), skip it
        const existing = configs[ch]![f.key];
        if (typeof existing === 'string' && existing.includes('•')) {
          // Don't send masked values — backend keeps the old one
        } else {
          config[f.key] = existing;
        }
      }
    }

    const res = await apiClient.put('/api/v1/admin/channel-settings', { channel: ch, config });
    if (res.success) {
      toast.success(t('savedToast', { name: channelDef.name }));
      await loadConfigs();
    } else {
      toast.error(res.error || t('saveErrorToast', { name: channelDef.name }));
    }
    setSaving((prev) => ({ ...prev, [ch]: false }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-xl font-bold">{t('title')}</h2>
      <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
      <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-xs text-[var(--color-text-secondary)]">
        {t('marketplacesNote')}
        <Link
          href="/admin/marketplaces"
          className="font-medium text-[var(--color-primary)] hover:underline"
        >
          /admin/marketplaces
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {CHANNELS.map((channelDef) => {
          const ch = channelDef.key;
          const form = forms[ch];
          const isEnabled = form.enabled === true;
          const result = testResults[ch];
          const hasDirtyFields = dirty[ch].size > 0;
          const hasRequiredFields = channelDef.fields
            .filter((f) => !f.optional)
            .every((f) => {
              const val = form[f.key];
              return typeof val === 'string' && val.length > 0;
            });

          return (
            <div
              key={ch}
              className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
                isEnabled
                  ? 'border-[var(--color-primary)]/30 bg-[var(--color-bg)] shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{channelDef.icon}</span>
                  <div>
                    <h3 className="font-semibold">{channelDef.name}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {channelDef.description}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isEnabled}
                    onChange={(e) => updateField(ch, 'enabled', e.target.checked)}
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--color-primary)] peer-checked:after:translate-x-full" />
                </label>
              </div>

              {/* Fields */}
              <div className="space-y-3 px-5 py-4">
                {channelDef.fields.map((field) => {
                  const tokenKey = `${ch}_${field.key}`;
                  const isShown = showTokens[tokenKey];
                  const value = String(form[field.key] || '');

                  return (
                    <div key={field.key}>
                      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        {field.label}
                        {field.optional && (
                          <span className="text-[var(--color-text-muted)]">
                            {t('optionalLabel')}
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <Input
                          type={field.sensitive && !isShown ? 'password' : 'text'}
                          value={value}
                          onChange={(e) => updateField(ch, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="pr-10 text-sm"
                        />
                        {field.sensitive && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowTokens((prev) => ({ ...prev, [tokenKey]: !isShown }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                          >
                            {isShown ? '🙈' : '👁️'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Test result */}
              {result && (
                <div
                  className={`mx-5 mb-3 rounded-lg px-3 py-2 text-sm ${
                    result.success
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  }`}
                >
                  {result.success ? (
                    <span>{t('connected', { name: result.name ?? '' })}</span>
                  ) : (
                    <span>{t('testFailed', { error: result.error ?? '' })}</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-5 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTest(channelDef)}
                  disabled={testing[ch] || !hasRequiredFields}
                >
                  {testing[ch] ? (
                    <>
                      <Spinner size="sm" /> {t('checking')}
                    </>
                  ) : (
                    t('checkConnection')
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(channelDef)}
                  disabled={saving[ch] || (!hasDirtyFields && configs[ch] !== null)}
                >
                  {saving[ch] ? (
                    <>
                      <Spinner size="sm" /> {t('saving')}
                    </>
                  ) : (
                    t('save')
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
