'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  PHONE_UA_PATTERN,
  IBAN_UA_PATTERN,
  EDRPOU_PATTERN,
  IPN_PATTERN,
} from '@/config/admin-constants';

interface PalletRegion {
  name: string;
  multiplier: number;
}

interface PalletConfig {
  enabled: boolean;
  minWeightKg: number;
  maxWeightKg: number;
  basePrice: number;
  pricePerKg: number;
  regions: PalletRegion[];
  freeDeliveryThreshold: number;
  estimatedDays: string;
}

type SectionKey =
  | 'general'
  | 'company'
  | 'social'
  | 'analytics'
  | 'display'
  | 'delivery'
  | 'ai'
  | 'loyalty';

type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  validate?: (v: string) => string | null;
  type?: 'text' | 'checkbox';
};
export default function AdminSettingsPage() {
  const t = useTranslations('admin.settingsPage');
  const SECTIONS: { key: SectionKey; label: string; fields: FieldDef[] }[] = useMemo(
    () => [
      {
        key: 'general',
        label: t('sec_general'),
        fields: [
          { key: 'site_name', label: t('f_site_name'), hint: t('h_site_name') },
          {
            key: 'site_phone',
            label: t('f_site_phone'),
            hint: t('h_site_phone'),
            validate: (v) => (v && !PHONE_UA_PATTERN.test(v) ? t('v_phone') : null),
          },
          {
            key: 'site_email',
            label: t('f_site_email'),
            hint: t('h_site_email'),
            validate: (v) => (v && !v.includes('@') ? t('v_email') : null),
          },
          { key: 'site_address', label: t('f_site_address'), hint: t('h_site_address') },
          { key: 'working_hours', label: t('f_working_hours'), hint: t('h_working_hours') },
          {
            key: 'company_description',
            label: t('f_company_description'),
            hint: t('h_company_description'),
          },
          {
            key: 'free_delivery_threshold',
            label: t('f_free_delivery_threshold'),
            hint: t('h_free_delivery_threshold'),
            validate: (v) => (v && !/^\d+$/.test(v) ? t('v_integer_uah') : null),
          },
        ],
      },
      {
        key: 'company',
        label: t('sec_company'),
        fields: [
          {
            key: 'company_legal_name',
            label: t('f_company_legal_name'),
            hint: t('h_company_legal_name'),
          },
          {
            key: 'company_edrpou',
            label: t('f_company_edrpou'),
            hint: t('h_company_edrpou'),
            validate: (v) => (v && !EDRPOU_PATTERN.test(v) ? t('v_edrpou') : null),
          },
          {
            key: 'company_ipn',
            label: t('f_company_ipn'),
            hint: t('h_company_ipn'),
            validate: (v) => (v && !IPN_PATTERN.test(v) ? t('v_ipn') : null),
          },
          {
            key: 'company_iban',
            label: t('f_company_iban'),
            hint: t('h_company_iban'),
            validate: (v) => (v && !IBAN_UA_PATTERN.test(v) ? t('v_iban') : null),
          },
          { key: 'company_bank', label: t('f_company_bank'), hint: t('h_company_bank') },
          { key: 'company_legal_address', label: t('f_company_legal_address') },
        ],
      },
      {
        key: 'social',
        label: t('sec_social'),
        fields: [
          { key: 'social_telegram', label: t('f_social_telegram'), hint: t('h_social_telegram') },
          { key: 'social_viber', label: t('f_social_viber'), hint: t('h_social_viber') },
          { key: 'social_facebook', label: t('f_social_facebook'), hint: t('h_social_facebook') },
          {
            key: 'social_instagram',
            label: t('f_social_instagram'),
            hint: t('h_social_instagram'),
          },
          { key: 'social_tiktok', label: t('f_social_tiktok'), hint: t('h_social_tiktok') },
        ],
      },
      {
        key: 'display',
        label: t('sec_display'),
        fields: [
          {
            key: 'hide_all_quantity',
            label: t('f_hide_all_quantity'),
            hint: t('h_hide_all_quantity'),
            type: 'checkbox',
          },
        ],
      },
      {
        key: 'analytics',
        label: t('sec_analytics'),
        fields: [
          {
            key: 'default_seo_title',
            label: t('f_default_seo_title'),
            hint: t('h_default_seo_title'),
          },
          {
            key: 'default_seo_description',
            label: t('f_default_seo_description'),
            hint: t('h_default_seo_description'),
          },
          {
            key: 'google_analytics_id',
            label: t('f_google_analytics_id'),
            hint: t('h_google_analytics_id'),
            validate: (v) => (v && !/^(G-[A-Z0-9]+|UA-\d+-\d+)$/.test(v) ? t('v_ga') : null),
          },
          {
            key: 'facebook_pixel_id',
            label: t('f_facebook_pixel_id'),
            hint: t('h_facebook_pixel_id'),
            validate: (v) => (v && !/^\d+$/.test(v) ? t('v_pixel') : null),
          },
          {
            key: 'pinterest_tag_id',
            label: t('f_pinterest_tag_id'),
            hint: t('h_pinterest_tag_id'),
            validate: (v) => (v && !/^\d{10,20}$/.test(v) ? t('v_pinterest_tag') : null),
          },
          {
            key: 'pinterest_domain_verify',
            label: t('f_pinterest_domain_verify'),
            hint: t('h_pinterest_domain_verify'),
            validate: (v) => (v && !/^[a-f0-9]{32}$/i.test(v) ? t('v_pinterest_domain') : null),
          },
        ],
      },
      {
        key: 'loyalty',
        label: t('sec_loyalty'),
        fields: [
          {
            key: 'loyalty_welcome_bonus',
            label: t('f_loyalty_welcome_bonus'),
            hint: t('h_loyalty_welcome_bonus'),
            validate: (v) => (v && !/^\d+$/.test(v) ? t('v_integer_off') : null),
          },
          {
            key: 'referral_referrer_bonus',
            label: t('f_referral_referrer_bonus'),
            hint: t('h_referral_referrer_bonus'),
            validate: (v) => (v && !/^\d+$/.test(v) ? t('v_integer_off') : null),
          },
          {
            key: 'referral_referee_bonus',
            label: t('f_referral_referee_bonus'),
            hint: t('h_referral_referee_bonus'),
            validate: (v) => (v && !/^\d+$/.test(v) ? t('v_integer_off') : null),
          },
          {
            key: 'loyalty_max_redemption_percent',
            label: t('f_loyalty_max_redemption_percent'),
            hint: t('h_loyalty_max_redemption_percent'),
            validate: (v) => {
              if (!v) return null;
              if (!/^\d+$/.test(v)) return t('v_int_0_100');
              const n = Number(v);
              if (n < 0 || n > 100) return t('v_range_0_100');
              return null;
            },
          },
        ],
      },
    ],
    [t],
  );

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('general');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    apiClient
      .get<Record<string, string>>('/api/v1/admin/settings')
      .then((res) => {
        if (res.success && res.data) setSettings(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const validateFields = (): boolean => {
    const section = SECTIONS.find((s) => s.key === activeSection);
    if (!section) return true;
    const errors: Record<string, string> = {};
    for (const field of section.fields) {
      if (field.validate) {
        const err = field.validate(settings[field.key] || '');
        if (err) errors[field.key] = err;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveClick = () => {
    if (!validateFields()) {
      toast.error(t('fixErrors'));
      return;
    }
    setConfirmSave(true);
  };

  const handleSaveConfirm = async () => {
    setConfirmSave(false);
    setIsSaving(true);
    const res = await apiClient.put('/api/v1/admin/settings', settings);
    if (res.success) {
      // Перечитуємо з сервера — якщо whitelist чи інший шар тихо
      // відкинув якесь поле, UI відразу покаже актуальне (а не задеклароване)
      // значення замість того, щоб ввести оператора в оману.
      const fresh = await apiClient.get<Record<string, string>>('/api/v1/admin/settings');
      if (fresh.success && fresh.data) setSettings(fresh.data);
      toast.success(t('saved'));
    } else {
      toast.error(res.error || t('saveError'));
    }
    setIsSaving(false);
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        {activeSection !== 'delivery' && activeSection !== 'ai' && (
          <Button onClick={handleSaveClick} isLoading={isSaving}>
            {t('save')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              setActiveSection(s.key);
              setFieldErrors({});
            }}
            className={`rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${activeSection === s.key ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setActiveSection('delivery')}
          className={`rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${activeSection === 'delivery' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
        >
          {t('tabPallet')}
        </button>
        <button
          onClick={() => {
            setActiveSection('ai');
            setFieldErrors({});
          }}
          className={`rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${activeSection === 'ai' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
        >
          {t('tabAi')}
        </button>
      </div>

      {/* Section content */}
      {activeSection === 'delivery' ? (
        <PalletDeliverySettings />
      ) : activeSection === 'ai' ? (
        <AISettings />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-4 text-lg font-semibold">
            {SECTIONS.find((s) => s.key === activeSection)?.label}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {SECTIONS.find((s) => s.key === activeSection)?.fields.map((field) =>
              field.type === 'checkbox' ? (
                <div key={field.key} className="md:col-span-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)]/60 p-3 hover:bg-[var(--color-bg-secondary)]/40">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={settings[field.key] === '1'}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          [field.key]: e.target.checked ? '1' : '0',
                        }))
                      }
                    />
                    <span>
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.hint && (
                        <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
                          {field.hint}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              ) : (
                <div key={field.key}>
                  <Input
                    label={field.label}
                    value={settings[field.key] || ''}
                    onChange={(e) => {
                      setSettings((prev) => ({ ...prev, [field.key]: e.target.value }));
                      if (fieldErrors[field.key]) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next[field.key];
                          return next;
                        });
                      }
                    }}
                    error={fieldErrors[field.key]}
                  />
                  {field.hint && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {field.hint}
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={handleSaveConfirm}
        title={t('confirmTitle')}
        message={t('confirmMsg')}
        confirmText={t('confirmBtn')}
      />
    </div>
  );
}

function PalletDeliverySettings() {
  const t = useTranslations('admin.settingsPage');
  const [config, setConfig] = useState<PalletConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    apiClient
      .get<PalletConfig>('/api/v1/admin/settings/pallet-delivery')
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSaveConfirm = useCallback(async () => {
    if (!config) return;
    setConfirmSave(false);
    setIsSaving(true);
    const res = await apiClient.put('/api/v1/admin/settings/pallet-delivery', config);
    setIsSaving(false);
    if (res.success) {
      toast.success(t('palletSaved'));
    } else {
      toast.error(t('saveError'));
    }
  }, [config, t]);

  const updateField = useCallback((field: keyof PalletConfig, value: unknown) => {
    setConfig((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const updateRegion = useCallback(
    (index: number, field: keyof PalletRegion, value: string | number) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const regions = [...prev.regions];
        regions[index] = { ...regions[index], [field]: value };
        return { ...prev, regions };
      });
    },
    [],
  );

  const addRegion = useCallback(() => {
    setConfig((prev) =>
      prev ? { ...prev, regions: [...prev.regions, { name: '', multiplier: 1 }] } : prev,
    );
  }, []);

  const removeRegion = useCallback((index: number) => {
    setConfig((prev) =>
      prev ? { ...prev, regions: prev.regions.filter((_, i) => i !== index) } : prev,
    );
  }, []);

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  if (!config) return null;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('palletTitle')}</h3>
        <Button onClick={() => setConfirmSave(true)} isLoading={isSaving}>
          {t('save')}
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateField('enabled', e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          {t('enabled')}
        </label>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Input
          label={t('minWeight')}
          type="number"
          value={String(config.minWeightKg)}
          onChange={(e) => updateField('minWeightKg', Number(e.target.value))}
        />
        <Input
          label={t('maxWeight')}
          type="number"
          value={String(config.maxWeightKg)}
          onChange={(e) => updateField('maxWeightKg', Number(e.target.value))}
        />
        <Input
          label={t('basePrice')}
          type="number"
          value={String(config.basePrice)}
          onChange={(e) => updateField('basePrice', Number(e.target.value))}
        />
        <Input
          label={t('pricePerKg')}
          type="number"
          value={String(config.pricePerKg)}
          onChange={(e) => updateField('pricePerKg', Number(e.target.value))}
        />
        <Input
          label={t('freeFrom')}
          type="number"
          value={String(config.freeDeliveryThreshold)}
          onChange={(e) => updateField('freeDeliveryThreshold', Number(e.target.value))}
        />
        <Input
          label={t('estimatedDays')}
          value={config.estimatedDays}
          onChange={(e) => updateField('estimatedDays', e.target.value)}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">{t('regions')}</h4>
          <button
            type="button"
            onClick={addRegion}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {t('addRegion')}
          </button>
        </div>
        <div className="space-y-2">
          {config.regions.map((region, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={region.name}
                onChange={(e) => updateRegion(i, 'name', e.target.value)}
                placeholder={t('regionNamePh')}
              />
              <Input
                type="number"
                value={String(region.multiplier)}
                onChange={(e) => updateRegion(i, 'multiplier', Number(e.target.value))}
                placeholder={t('multiplierPh')}
              />
              <button
                type="button"
                onClick={() => removeRegion(i)}
                className="shrink-0 text-xs text-[var(--color-danger)] hover:underline"
              >
                {t('delete')}
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={handleSaveConfirm}
        title={t('palletConfirmTitle')}
        message={t('palletConfirmMsg')}
        confirmText={t('confirmBtn')}
      />
    </div>
  );
}

// Google retired Gemini 1.5 models in late 2025 — keep this list to the
// currently-available ones. If a deprecated value is read from DB we coerce
// it back to the default on form load.
const GEMINI_MODEL_VALUES = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
] as const;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

function AISettings() {
  const t = useTranslations('admin.settingsPage');
  const GEMINI_MODELS: { value: string; label: string }[] = useMemo(
    () => [
      { value: 'gemini-2.5-flash', label: t('gemini_25_flash') },
      { value: 'gemini-2.5-flash-lite', label: t('gemini_25_flash_lite') },
      { value: 'gemini-2.5-pro', label: t('gemini_25_pro') },
      { value: 'gemini-2.0-flash', label: t('gemini_20_flash') },
      { value: 'gemini-2.0-flash-lite', label: t('gemini_20_flash_lite') },
    ],
    [t],
  );
  const [form, setForm] = useState({
    anthropic_api_key: '',
    gemini_api_key: '',
    gemini_model: DEFAULT_GEMINI_MODEL,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testing, setTesting] = useState<null | 'claude' | 'gemini'>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    apiClient
      .get<Record<string, string>>('/api/v1/admin/settings')
      .then((res) => {
        if (res.success && res.data) {
          const saved = res.data.gemini_model || DEFAULT_GEMINI_MODEL;
          const isValid = (GEMINI_MODEL_VALUES as readonly string[]).includes(saved);
          setForm({
            anthropic_api_key: res.data.anthropic_api_key || '',
            gemini_api_key: res.data.gemini_api_key || '',
            gemini_model: isValid ? saved : DEFAULT_GEMINI_MODEL,
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setConfirmSave(false);
    setIsSaving(true);
    const res = await apiClient.put('/api/v1/admin/settings', form);
    if (res.success) {
      const fresh = await apiClient.get<Record<string, string>>('/api/v1/admin/settings');
      if (fresh.success && fresh.data) {
        setForm({
          anthropic_api_key: fresh.data.anthropic_api_key || '',
          gemini_api_key: fresh.data.gemini_api_key || '',
          gemini_model: fresh.data.gemini_model || 'gemini-1.5-flash',
        });
      }
      toast.success(t('aiSaved'));
    } else {
      toast.error(res.error || t('saveError'));
    }
    setIsSaving(false);
  };

  const handleTest = async (provider: 'claude' | 'gemini') => {
    setTesting(provider);
    try {
      const payload: Record<string, string> = { provider };
      if (provider === 'claude') {
        payload.apiKey = form.anthropic_api_key;
      } else {
        payload.apiKey = form.gemini_api_key;
        payload.model = form.gemini_model;
      }
      const res = await apiClient.post<{ ok: boolean }>('/api/v1/admin/settings/test-ai', payload);
      if (res.success) {
        toast.success(t('testOk', { provider: provider === 'claude' ? 'Claude' : 'Gemini' }));
      } else {
        toast.error(res.error || t('testFailed'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setTesting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('aiTitle')}</h3>
        <Button onClick={() => setConfirmSave(true)} isLoading={isSaving}>
          {t('save')}
        </Button>
      </div>

      <p className="mb-4 text-xs text-[var(--color-text-secondary)]">{t('aiKeysHint')}</p>

      <div className="space-y-5">
        {/* Claude */}
        <div className="rounded-md border border-[var(--color-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{t('claudeTitle')}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('claudeHintBefore')}
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-primary)] hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest('claude')}
              isLoading={testing === 'claude'}
              disabled={testing !== null}
            >
              {t('test')}
            </Button>
          </div>
          <Input
            label="ANTHROPIC_API_KEY"
            value={form.anthropic_api_key}
            onChange={(e) => setForm({ ...form, anthropic_api_key: e.target.value })}
            placeholder="sk-ant-..."
            type="password"
            autoComplete="off"
          />
        </div>

        {/* Gemini */}
        <div className="rounded-md border border-[var(--color-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{t('geminiTitle')}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('geminiHintBefore')}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-primary)] hover:underline"
                >
                  aistudio.google.com/apikey
                </a>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest('gemini')}
              isLoading={testing === 'gemini'}
              disabled={testing !== null}
            >
              {t('test')}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Input
              label="GEMINI_API_KEY"
              value={form.gemini_api_key}
              onChange={(e) => setForm({ ...form, gemini_api_key: e.target.value })}
              placeholder="AIza..."
              type="password"
              autoComplete="off"
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('modelLabel')}</label>
              <select
                value={form.gemini_model}
                onChange={(e) => setForm({ ...form, gemini_model: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={handleSave}
        title={t('aiConfirmTitle')}
        message={t('aiConfirmMsg')}
        confirmText={t('confirmBtn')}
      />
    </div>
  );
}
