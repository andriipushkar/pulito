'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface DeliveryProvider {
  key: string;
  name: string;
  icon: string;
  description: string;
  enabledKey: string;
  testable?: boolean;
  costKey?: string;
  fields: { key: string; label: string; placeholder: string; sensitive?: boolean; hint?: string }[];
}

interface TestResult {
  success: boolean;
  name?: string;
  error?: string;
}

export default function DeliverySettingsPage() {
  const t = useTranslations('admin.deliverySettingsPage');
  const PROVIDERS: DeliveryProvider[] = useMemo(
    () => [
      {
        key: 'nova_poshta',
        name: t('novaName'),
        icon: '🔴',
        description: t('novaDesc'),
        enabledKey: 'delivery_nova_poshta_enabled',
        testable: true,
        costKey: 'delivery_nova_poshta_fixed_cost',
        fields: [
          {
            key: 'delivery_nova_poshta_api_key',
            label: t('novaApiKey'),
            placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            sensitive: true,
            hint: t('novaApiKeyHint'),
          },
          {
            key: 'delivery_nova_poshta_sender_ref',
            label: t('novaSenderRef'),
            placeholder: '00000000-0000-0000-0000-000000000000',
            hint: t('novaSenderRefHint'),
          },
          {
            key: 'delivery_nova_poshta_sender_city_ref',
            label: t('novaCityRef'),
            placeholder: '00000000-0000-0000-0000-000000000000',
            hint: t('novaCityRefHint'),
          },
          {
            key: 'delivery_nova_poshta_sender_warehouse_ref',
            label: t('novaWarehouseRef'),
            placeholder: '00000000-0000-0000-0000-000000000000',
            hint: t('novaWarehouseRefHint'),
          },
          {
            key: 'delivery_nova_poshta_sender_phone',
            label: t('senderPhone'),
            placeholder: '+380501234567',
          },
          {
            key: 'delivery_nova_poshta_balance_note',
            label: t('novaBalanceNote'),
            placeholder: t('novaBalanceNotePh'),
            hint: t('novaBalanceNoteHint'),
          },
        ],
      },
      {
        key: 'ukrposhta',
        name: t('ukrName'),
        icon: '🟡',
        description: t('ukrDesc'),
        enabledKey: 'delivery_ukrposhta_enabled',
        testable: true,
        costKey: 'delivery_ukrposhta_fixed_cost',
        fields: [
          {
            key: 'delivery_ukrposhta_bearer_token',
            label: t('ukrBearerToken'),
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            sensitive: true,
            hint: t('ukrBearerTokenHint'),
          },
          {
            key: 'delivery_ukrposhta_sender_name',
            label: t('ukrSenderName'),
            placeholder: t('ukrSenderNamePh'),
          },
          {
            key: 'delivery_ukrposhta_sender_phone',
            label: t('senderPhone'),
            placeholder: '+380501234567',
          },
          {
            key: 'delivery_ukrposhta_sender_address',
            label: t('ukrSenderAddress'),
            placeholder: t('ukrSenderAddressPh'),
          },
        ],
      },
      {
        key: 'pickup',
        name: t('pickupName'),
        icon: '📍',
        description: t('pickupDesc'),
        enabledKey: 'delivery_pickup_enabled',
        fields: [
          {
            key: 'delivery_pickup_address',
            label: t('pickupAddress'),
            placeholder: t('pickupAddressPh'),
          },
          {
            key: 'delivery_pickup_hours',
            label: t('pickupHours'),
            placeholder: t('pickupHoursPh'),
          },
          { key: 'delivery_pickup_phone', label: t('pickupPhone'), placeholder: '+380501234567' },
        ],
      },
    ],
    [t],
  );
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(new Set<string>());
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [confirmSave, setConfirmSave] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});

  // Reload via token bump; effect performs the async fetch so setState only
  // runs in the async callback.
  const [reloadToken, setReloadToken] = useState(0);
  const loadSettings = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<Record<string, string>>('/api/v1/admin/delivery-settings').then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setSettings(res.data);
        setDirty(new Set());
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const updateField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set(prev).add(key));
  };

  const toggleEnabled = (key: string) => {
    const current = settings[key] === 'true';
    updateField(key, current ? 'false' : 'true');
  };

  const handleSave = async (confirmClearSensitive = false) => {
    setConfirmSave(false);
    setIsSaving(true);
    const payload = confirmClearSensitive
      ? { ...settings, __confirmClearSensitive: true }
      : settings;
    const res = await apiClient.put('/api/v1/admin/delivery-settings', payload);
    if (res.success) {
      toast.success(t('savedToast'));
      await loadSettings();
    } else if (res.statusCode === 422 && res.error?.includes('__confirmClearSensitive')) {
      const ok = window.confirm(t('confirmClearSensitive', { error: res.error }));
      if (ok) {
        setIsSaving(false);
        return handleSave(true);
      }
    } else {
      toast.error(res.error || t('saveError'));
    }
    setIsSaving(false);
  };

  const handleTest = async (provider: DeliveryProvider) => {
    setTesting((prev) => ({ ...prev, [provider.key]: true }));
    setTestResults((prev) => ({ ...prev, [provider.key]: null }));

    const configMap: Record<string, Record<string, string>> = {
      nova_poshta: { apiKey: settings['delivery_nova_poshta_api_key'] || '' },
      ukrposhta: { bearerToken: settings['delivery_ukrposhta_bearer_token'] || '' },
    };

    const res = await apiClient.post<TestResult>('/api/v1/admin/delivery-settings/test', {
      provider: provider.key,
      config: configMap[provider.key],
    });

    setTestResults((prev) => ({
      ...prev,
      [provider.key]:
        res.success && res.data ? res.data : { success: false, error: t('requestError') },
    }));
    setTesting((prev) => ({ ...prev, [provider.key]: false }));
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        <Button
          onClick={() => setConfirmSave(true)}
          isLoading={isSaving}
          disabled={dirty.size === 0}
        >
          {t('save')}
        </Button>
      </div>

      {/* Free shipping threshold */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🚛</span>
          <div>
            <h3 className="font-semibold">{t('freeShippingTitle')}</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('freeShippingHint')}</p>
          </div>
        </div>
        <div className="max-w-xs">
          <Input
            label={t('thresholdLabel')}
            type="number"
            value={settings['delivery_free_shipping_threshold'] || ''}
            onChange={(e) => updateField('delivery_free_shipping_threshold', e.target.value)}
            placeholder="2000"
          />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('emptyToDisable')}</p>
        </div>
      </div>

      {/* Delivery providers */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const isEnabled = settings[provider.enabledKey] === 'true';
          const result = testResults[provider.key];

          return (
            <div
              key={provider.key}
              className={`rounded-xl border p-5 transition-all ${
                isEnabled
                  ? 'border-green-200 bg-[var(--color-bg)] shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <h3 className="font-semibold">{provider.name}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {provider.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleEnabled(provider.enabledKey)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    isEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                  />
                </button>
              </div>

              {provider.fields.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {provider.fields.map((field) => {
                    const tokenKey = `${provider.key}_${field.key}`;
                    const isShown = showTokens[tokenKey];
                    return (
                      <div key={field.key}>
                        <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                          {field.label}
                        </label>
                        <div className="relative">
                          <Input
                            type={field.sensitive && !isShown ? 'password' : 'text'}
                            value={settings[field.key] || ''}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            placeholder={field.placeholder}
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
                        {field.hint && (
                          <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                            {field.hint}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fixed delivery cost */}
              {provider.costKey && (
                <div className="mt-3 max-w-xs">
                  <Input
                    label={t('fixedCostLabel')}
                    type="number"
                    value={settings[provider.costKey] || ''}
                    onChange={(e) => updateField(provider.costKey!, e.target.value)}
                    placeholder={t('fixedCostPh')}
                  />
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                    {t('fixedCostHint')}
                  </p>
                </div>
              )}

              {/* Test result */}
              {result && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                    result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {result.success
                    ? t('testSuccess', { name: result.name ?? '' })
                    : t('testFailed', { error: result.error ?? '' })}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                {provider.testable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(provider)}
                    disabled={testing[provider.key]}
                  >
                    {testing[provider.key] ? t('testing') : t('testConnection')}
                  </Button>
                )}
                {isEnabled && (
                  <span className="flex items-center gap-1.5 text-xs text-green-600">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    {t('enabledBadge')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Link to pallet delivery */}
      <div className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-semibold">{t('palletTitle')}</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">{t('palletDesc')}</p>
            </div>
          </div>
          <Link
            href="/admin/pallet-delivery"
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            {t('configure')}
          </Link>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={() => handleSave()}
        title={t('confirmTitle')}
        message={t('confirmMsg')}
        confirmText={t('confirmBtn')}
      />
    </div>
  );
}
