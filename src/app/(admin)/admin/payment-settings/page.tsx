'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
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
  fields: { key: string; label: string; placeholder: string; sensitive?: boolean }[];
}

const PROVIDERS: PaymentProvider[] = [
  {
    key: 'liqpay',
    name: 'LiqPay',
    icon: '💳',
    description: 'Оплата картою Visa/Mastercard через LiqPay (ПриватБанк)',
    enabledKey: 'payment_liqpay_enabled',
    testable: true,
    webhookPath: '/api/webhooks/liqpay',
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
      { key: 'payment_liqpay_sandbox', label: 'Sandbox режим (true/false)', placeholder: 'true' },
    ],
  },
  {
    key: 'monobank',
    name: 'Monobank',
    icon: '🏦',
    description: 'Оплата через Monobank Acquiring (прямий еквайринг)',
    enabledKey: 'payment_monobank_enabled',
    testable: true,
    webhookPath: '/api/webhooks/monobank',
    fields: [
      {
        key: 'payment_monobank_token',
        label: 'API Token',
        placeholder: 'uXxxxxXXXXxxxxxXXXXX',
        sensitive: true,
      },
    ],
  },
  {
    key: 'wayforpay',
    name: 'WayForPay',
    icon: '🔐',
    description: 'Оплата через WayForPay (Visa/Mastercard/Apple Pay/Google Pay)',
    enabledKey: 'payment_wayforpay_enabled',
    testable: true,
    webhookPath: '/api/webhooks/wayforpay',
    fields: [
      {
        key: 'payment_wayforpay_merchant_account',
        label: 'Merchant Account',
        placeholder: 'your_merchant_account',
      },
      {
        key: 'payment_wayforpay_secret_key',
        label: 'Secret Key',
        placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        sensitive: true,
      },
    ],
  },
];

const OFFLINE_METHODS: PaymentProvider[] = [
  {
    key: 'cod',
    name: 'Накладений платіж',
    icon: '📦',
    description: 'Оплата при отриманні товару (Нова Пошта, Укрпошта)',
    enabledKey: 'payment_cod_enabled',
    fields: [],
  },
  {
    key: 'bank_transfer',
    name: 'Банківський переказ',
    icon: '🏛️',
    description: 'Оплата за реквізитами на розрахунковий рахунок',
    enabledKey: 'payment_bank_transfer_enabled',
    fields: [
      {
        key: 'payment_bank_transfer_details',
        label: 'Реквізити для оплати',
        placeholder: 'IBAN, банк, отримувач...',
      },
    ],
  },
  {
    key: 'card_prepay',
    name: 'Передоплата на картку',
    icon: '💰',
    description: 'Переказ на картку ФОП',
    enabledKey: 'payment_card_prepay_enabled',
    fields: [
      {
        key: 'payment_card_prepay_details',
        label: 'Номер картки та деталі',
        placeholder: '5375 4141 XXXX XXXX (ПриватБанк)',
      },
    ],
  },
];

interface TestResult {
  success: boolean;
  name?: string;
  error?: string;
}

export default function PaymentSettingsPage() {
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
      toast.success('Налаштування платежів збережено');
      await loadSettings();
    } else if (res.statusCode === 422 && res.error?.includes('__confirmClearSensitive')) {
      // The server detected sensitive credentials being cleared. Ask the user
      // explicitly — accidental "Save" with an empty key field has historically
      // silently disabled providers.
      const ok = window.confirm(
        `${res.error}\n\n` +
          `OK — стерти креденшли і вимкнути провайдера.\n` +
          `Cancel — скасувати і повернутись до форми.`,
      );
      if (ok) {
        setIsSaving(false);
        return handleSave(true);
      }
    } else {
      toast.error(res.error || 'Помилка збереження');
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
      wayforpay: { merchantAccount: settings['payment_wayforpay_merchant_account'] || '' },
    };

    const res = await apiClient.post<TestResult>('/api/v1/admin/payment-settings/test', {
      provider: provider.key,
      config: configMap[provider.key],
    });

    setTestResults((prev) => ({
      ...prev,
      [provider.key]:
        res.success && res.data ? res.data : { success: false, error: 'Помилка запиту' },
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
              Webhook URL
            </p>
            <code className="block break-all text-xs text-[var(--color-primary)]">
              {appUrl}
              {provider.webhookPath}
            </code>
            <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
              Вкажіть цей URL у кабінеті {provider.name}
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
            {result.success ? `✅ ${result.name}` : `❌ ${result.error}`}
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
              {testing[provider.key] ? 'Перевірка...' : "Перевірити з'єднання"}
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
              Увімкнено
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
          <h2 className="text-xl font-bold">Платіжні системи</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Налаштуйте способи оплати для вашого магазину
          </p>
        </div>
        <Button
          onClick={() => setConfirmSave(true)}
          isLoading={isSaving}
          disabled={dirty.size === 0}
        >
          Зберегти
        </Button>
      </div>

      <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
        Онлайн оплата
      </h3>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">{PROVIDERS.map(renderProvider)}</div>

      {/* Apple Pay / Google Pay quick-checkout */}
      <div className="mb-6 rounded-xl border border-black/20 bg-gradient-to-br from-gray-50 to-gray-100 p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="text-2xl">⚡</span>
          <div className="flex-1">
            <h3 className="font-semibold">Apple Pay та Google Pay</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Швидка оплата в один клік. Маршрутизується через WayForPay (пріоритет) або LiqPay —
              достатньо мати один з них налаштованим. У кабінеті провайдера треба окремо активувати
              Apple Pay merchant ID + перевірити доменне підтвердження (
              <code>/.well-known/apple-developer-merchantid-domain-association</code>).
            </p>
          </div>
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
              <h3 className="font-semibold">ПриватБанк — Оплата частинами</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Розстрочка від ПриватБанку через LiqPay (paytypes=paypart). Потребує налаштованого
                LiqPay вище.
              </p>
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
            label="Кількість місяців розстрочки (2–24)"
            type="number"
            min={2}
            max={24}
            value={settings['payment_liqpay_paypart_count'] || ''}
            onChange={(e) => updateField('payment_liqpay_paypart_count', e.target.value)}
            placeholder="3"
          />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Зазвичай 3 або 6. Комісію за розстрочку платить мерчант.
          </p>
        </div>
      </div>

      {/* LiqPay sandbox notice */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🧪</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-amber-800">LiqPay Sandbox-режим</h4>
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
            <p className="mt-1 text-xs text-amber-700">
              Якщо увімкнено — оплати йдуть через тестовий процесинг (`sandbox=1`). Гроші не
              списуються. Перед launch виключи!
            </p>
          </div>
        </div>
      </div>

      {/* Min online amount */}
      <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔒</span>
          <div>
            <h3 className="font-semibold">Мінімальна сума для онлайн оплати</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Замовлення нижче цієї суми не зможуть оплатити онлайн
            </p>
          </div>
        </div>
        <div className="max-w-xs">
          <Input
            label="Мінімальна сума (грн)"
            type="number"
            value={settings['payment_min_online_amount'] || ''}
            onChange={(e) => updateField('payment_min_online_amount', e.target.value)}
            placeholder="100"
          />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Залиште порожнім щоб вимкнути обмеження
          </p>
        </div>
      </div>

      <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
        Офлайн способи
      </h3>
      <div className="grid gap-4 lg:grid-cols-2">{OFFLINE_METHODS.map(renderProvider)}</div>

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={() => handleSave()}
        title="Зберегти налаштування платежів"
        message="Зміни вплинуть на доступні способи оплати на сайті. Продовжити?"
        confirmText="Так, зберегти"
      />
    </div>
  );
}
