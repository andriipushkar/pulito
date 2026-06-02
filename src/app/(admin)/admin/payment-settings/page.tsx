'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PaymentProvider {
  key: string;
  name: string;
  icon: string;
  description: string;
  enabledKey: string;
  testable?: boolean;
  webhookPath?: string;
  /** Provider cabinet (where keys are issued and the method is enabled). */
  cabinetUrl?: string;
  /** Official API documentation. */
  docsUrl?: string;
  /** i18n key for the step-by-step setup guide (rendered as pre-line text). */
  setupKey?: string;
  fields: { key: string; label: string; placeholder: string; sensitive?: boolean }[];
}

interface TestResult {
  success: boolean;
  name?: string;
  error?: string;
}

export default function PaymentSettingsPage() {
  const t = useTranslations('admin.paymentSettingsPage');
  const PROVIDERS: PaymentProvider[] = useMemo(
    () => [
      {
        key: 'liqpay',
        name: 'LiqPay',
        icon: '💳',
        description: t('liqpayDesc'),
        enabledKey: 'payment_liqpay_enabled',
        testable: true,
        webhookPath: '/api/webhooks/liqpay',
        cabinetUrl: 'https://www.liqpay.ua/',
        docsUrl: 'https://www.liqpay.ua/en/documentation/api/home',
        setupKey: 'liqpaySetup',
        fields: [
          {
            key: 'payment_liqpay_public_key',
            label: 'Public Key',
            placeholder: 'sandbox_i00000000000',
          },
          {
            key: 'payment_liqpay_private_key',
            label: 'Private Key',
            placeholder: 'sandbox_0000000000000000000000',
            sensitive: true,
          },
          { key: 'payment_liqpay_sandbox', label: t('liqpaySandboxField'), placeholder: 'true' },
        ],
      },
      {
        key: 'monobank',
        name: 'Monobank',
        icon: '🏦',
        description: t('monobankDesc'),
        enabledKey: 'payment_monobank_enabled',
        testable: true,
        webhookPath: '/api/webhooks/monobank',
        cabinetUrl: 'https://web.monobank.ua/',
        docsUrl: 'https://api.monobank.ua/docs/acquiring.html',
        setupKey: 'monobankSetup',
        fields: [
          {
            key: 'payment_monobank_token',
            label: t('monobankToken'),
            placeholder: 'uXxxxxXXXXxxxxxXXXXX',
            sensitive: true,
          },
        ],
      },
      {
        key: 'wayforpay',
        name: 'WayForPay',
        icon: '🔐',
        description: t('wayforpayDesc'),
        enabledKey: 'payment_wayforpay_enabled',
        testable: true,
        webhookPath: '/api/webhooks/wayforpay',
        cabinetUrl: 'https://m.wayforpay.com/',
        docsUrl: 'https://wiki.wayforpay.com/',
        setupKey: 'wayforpaySetup',
        fields: [
          {
            key: 'payment_wayforpay_merchant_account',
            label: t('wfpMerchant'),
            placeholder: 'your_merchant_account',
          },
          {
            key: 'payment_wayforpay_secret_key',
            label: t('wfpSecret'),
            placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            sensitive: true,
          },
        ],
      },
    ],
    [t],
  );
  const OFFLINE_METHODS: PaymentProvider[] = useMemo(
    () => [
      {
        key: 'cod',
        name: t('codName'),
        icon: '📦',
        description: t('codDesc'),
        enabledKey: 'payment_cod_enabled',
        fields: [],
      },
      {
        key: 'bank_transfer',
        name: t('bankName'),
        icon: '🏛️',
        description: t('bankDesc'),
        enabledKey: 'payment_bank_transfer_enabled',
        fields: [
          {
            key: 'payment_bank_transfer_details',
            label: t('bankDetails'),
            placeholder: t('bankDetailsPh'),
          },
        ],
      },
      {
        key: 'card_prepay',
        name: t('cardPrepayName'),
        icon: '💰',
        description: t('cardPrepayDesc'),
        enabledKey: 'payment_card_prepay_enabled',
        fields: [
          {
            key: 'payment_card_prepay_details',
            label: t('cardPrepayDetails'),
            placeholder: t('cardPrepayDetailsPh'),
          },
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

  // Reload via token bump; fetch lives in the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const loadSettings = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<Record<string, string>>('/api/v1/admin/payment-settings').then((res) => {
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
    const res = await apiClient.put('/api/v1/admin/payment-settings', payload);
    if (res.success) {
      toast.success(t('savedToast'));
      await loadSettings();
    } else if (res.statusCode === 422 && res.error?.includes('__confirmClearSensitive')) {
      // The server detected sensitive credentials being cleared. Ask the user
      // explicitly — accidental "Save" with an empty key field has historically
      // silently disabled providers.
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

  const handleTest = async (provider: PaymentProvider) => {
    setTesting((prev) => ({ ...prev, [provider.key]: true }));
    setTestResults((prev) => ({ ...prev, [provider.key]: null }));

    const configMap: Record<string, Record<string, string>> = {
      liqpay: {
        publicKey: settings['payment_liqpay_public_key'] || '',
        privateKey: settings['payment_liqpay_private_key'] || '',
      },
      monobank: { token: settings['payment_monobank_token'] || '' },
      wayforpay: {
        merchantAccount: settings['payment_wayforpay_merchant_account'] || '',
        secretKey: settings['payment_wayforpay_secret_key'] || '',
      },
    };

    const res = await apiClient.post<TestResult>('/api/v1/admin/payment-settings/test', {
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

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );

  const renderProvider = (provider: PaymentProvider) => {
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
              <p className="text-xs text-[var(--color-text-secondary)]">{provider.description}</p>
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
          <div className="space-y-3">
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
                        onClick={() => setShowTokens((prev) => ({ ...prev, [tokenKey]: !isShown }))}
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
        )}

        {/* Webhook URL */}
        {provider.webhookPath && (
          <div className="mt-3 rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2">
            <p className="mb-1 text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">
              {t('webhookUrl')}
            </p>
            <code className="block break-all text-xs text-[var(--color-primary)]">
              {appUrl}
              {provider.webhookPath}
            </code>
            <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
              {t('webhookHint', { name: provider.name })}
            </p>
          </div>
        )}

        {/* Setup guide: step-by-step + links to the provider cabinet & docs */}
        {provider.setupKey && (
          <details className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-[var(--color-text-secondary)]">
              {t('setupGuideTitle')}
            </summary>
            <p className="mt-2 whitespace-pre-line text-xs text-[var(--color-text-secondary)]">
              {t(provider.setupKey)}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {provider.cabinetUrl && (
                <a
                  href={provider.cabinetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[var(--color-primary)] underline"
                >
                  ↗ {t('cabinetLink')}
                </a>
              )}
              {provider.docsUrl && (
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[var(--color-primary)] underline"
                >
                  ↗ {t('docsLink')}
                </a>
              )}
            </div>
          </details>
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {t('enabledBadge')}
            </span>
          )}
        </div>
      </div>
    );
  };

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

      <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
        {t('onlineSection')}
      </h3>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">{PROVIDERS.map(renderProvider)}</div>

      {/* Apple Pay / Google Pay quick-checkout */}
      <div className="mb-6 rounded-xl border border-black/20 bg-gradient-to-br from-gray-50 to-gray-100 p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="text-2xl">⚡</span>
          <div className="flex-1">
            <h3 className="font-semibold">{t('applePayTitle')}</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('applePayDesc')}</p>
          </div>
        </div>
        <p className="mb-3 whitespace-pre-line text-xs text-[var(--color-text-secondary)]">
          {t('walletSetup')}
        </p>
        <div className="mb-3 flex flex-wrap gap-3">
          <a
            href="https://www.liqpay.ua/en/doc/api/internet_acquiring/apay"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[var(--color-primary)] underline"
          >
            ↗ {t('walletLiqpayDoc')}
          </a>
          <a
            href="https://help.wayforpay.com/uk/apple-pay"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[var(--color-primary)] underline"
          >
            ↗ {t('walletWfpDoc')}
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-black text-xs font-bold text-white">
                A
              </span>
              <span className="text-sm font-medium">Apple Pay</span>
            </div>
            <button
              onClick={() => toggleEnabled('payment_apple_pay_enabled')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                settings['payment_apple_pay_enabled'] !== 'false' ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  settings['payment_apple_pay_enabled'] !== 'false'
                    ? 'translate-x-[22px]'
                    : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-black text-xs font-bold text-white">
                G
              </span>
              <span className="text-sm font-medium">Google Pay</span>
            </div>
            <button
              onClick={() => toggleEnabled('payment_google_pay_enabled')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                settings['payment_google_pay_enabled'] !== 'false' ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  settings['payment_google_pay_enabled'] !== 'false'
                    ? 'translate-x-[22px]'
                    : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* LiqPay "Оплата частинами" */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h3 className="font-semibold">{t('paypartTitle')}</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">{t('paypartDesc')}</p>
            </div>
          </div>
          <button
            onClick={() => toggleEnabled('payment_liqpay_paypart_enabled')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              settings['payment_liqpay_paypart_enabled'] === 'true' ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                settings['payment_liqpay_paypart_enabled'] === 'true'
                  ? 'translate-x-[22px]'
                  : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>
        <div className="max-w-xs">
          <Input
            label={t('paypartMonths')}
            type="number"
            min={2}
            max={24}
            value={settings['payment_liqpay_paypart_count'] || ''}
            onChange={(e) => updateField('payment_liqpay_paypart_count', e.target.value)}
            placeholder="3"
          />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('paypartHint')}</p>
        </div>
      </div>

      {/* LiqPay sandbox notice */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🧪</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-amber-800">{t('sandboxTitle')}</h4>
              <button
                onClick={() => toggleEnabled('payment_liqpay_sandbox')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  settings['payment_liqpay_sandbox'] === 'true' ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    settings['payment_liqpay_sandbox'] === 'true'
                      ? 'translate-x-[18px]'
                      : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>
            <p className="mt-1 text-xs text-amber-700">{t('sandboxHint')}</p>
          </div>
        </div>
      </div>

      {/* Min online amount */}
      <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔒</span>
          <div>
            <h3 className="font-semibold">{t('minOnlineTitle')}</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('minOnlineDesc')}</p>
          </div>
        </div>
        <div className="max-w-xs">
          <Input
            label={t('minOnlineLabel')}
            type="number"
            value={settings['payment_min_online_amount'] || ''}
            onChange={(e) => updateField('payment_min_online_amount', e.target.value)}
            placeholder="100"
          />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('minOnlineHint')}</p>
        </div>
      </div>

      <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
        {t('offlineSection')}
      </h3>
      <div className="grid gap-4 lg:grid-cols-2">{OFFLINE_METHODS.map(renderProvider)}</div>

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
