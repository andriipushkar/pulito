'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
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
const SECTIONS: { key: SectionKey; label: string; fields: FieldDef[] }[] = [
  {
    key: 'general',
    label: 'Загальні',
    fields: [
      {
        key: 'site_name',
        label: 'Назва сайту',
        hint: 'Відображається у заголовку браузера та листах',
      },
      {
        key: 'site_phone',
        label: 'Телефон',
        hint: 'Формат: +380XXXXXXXXX',
        validate: (v) =>
          v && !PHONE_UA_PATTERN.test(v) ? 'Невірний формат. Використовуйте +380XXXXXXXXX' : null,
      },
      {
        key: 'site_email',
        label: 'Email',
        hint: 'Основний email для листів від клієнтів',
        validate: (v) => (v && !v.includes('@') ? 'Невірний формат email' : null),
      },
      { key: 'site_address', label: 'Адреса', hint: 'Фізична адреса для контактної сторінки' },
      { key: 'working_hours', label: 'Графік роботи', hint: 'Наприклад: Пн-Пт 9:00-18:00' },
      {
        key: 'company_description',
        label: 'Опис компанії',
        hint: 'Коротко про магазин — для футера, Open Graph, JSON-LD та PDF-документів',
      },
      {
        key: 'free_delivery_threshold',
        label: 'Поріг безкоштовної доставки (грн)',
        hint: 'Сума замовлення, від якої доставка безкоштовна. Відображається у TopBar.',
        validate: (v) => (v && !/^\d+$/.test(v) ? 'Має бути цілим числом у гривнях' : null),
      },
    ],
  },
  {
    key: 'company',
    label: 'Юридична інформація',
    fields: [
      { key: 'company_legal_name', label: 'Юридична назва', hint: 'Повна назва ФОП або ТОВ' },
      {
        key: 'company_edrpou',
        label: 'ЄДРПОУ',
        hint: '8-значний код з ЄДР',
        validate: (v) => (v && !EDRPOU_PATTERN.test(v) ? 'ЄДРПОУ має містити рівно 8 цифр' : null),
      },
      {
        key: 'company_ipn',
        label: 'ІПН',
        hint: '10- або 12-значний податковий номер',
        validate: (v) => (v && !IPN_PATTERN.test(v) ? 'ІПН має містити 10 або 12 цифр' : null),
      },
      {
        key: 'company_iban',
        label: 'IBAN',
        hint: 'UA + 27 цифр — банківський рахунок для оплат',
        validate: (v) =>
          v && !IBAN_UA_PATTERN.test(v) ? 'IBAN має починатися з UA та містити 29 символів' : null,
      },
      { key: 'company_bank', label: 'Банк', hint: 'Назва банку для реквізитів в рахунках' },
      { key: 'company_legal_address', label: 'Юридична адреса' },
    ],
  },
  {
    key: 'social',
    label: 'Соціальні мережі',
    fields: [
      {
        key: 'social_telegram',
        label: 'Telegram канал',
        hint: 'Посилання виду https://t.me/channel',
      },
      { key: 'social_viber', label: 'Viber спільнота', hint: 'Повне посилання на спільноту Viber' },
      {
        key: 'social_facebook',
        label: 'Facebook URL',
        hint: 'Повне посилання на сторінку Facebook',
      },
      {
        key: 'social_instagram',
        label: 'Instagram URL',
        hint: 'Повне посилання на профіль Instagram',
      },
      { key: 'social_tiktok', label: 'TikTok URL', hint: 'Повне посилання на профіль TikTok' },
    ],
  },
  {
    key: 'display',
    label: 'Відображення',
    fields: [
      {
        key: 'hide_all_quantity',
        label: 'Приховувати кількість товарів для всіх позицій',
        hint: 'Якщо увімкнено — на сайті показується тільки «В наявності» / «Немає», без точної цифри. Перебиває per-product галочку.',
        type: 'checkbox',
      },
    ],
  },
  {
    key: 'analytics',
    label: 'SEO та аналітика',
    fields: [
      {
        key: 'default_seo_title',
        label: 'SEO Title (за замовч.)',
        hint: 'Заголовок для сторінок без власного SEO-title (до 70 символів)',
      },
      {
        key: 'default_seo_description',
        label: 'SEO Description (за замовч.)',
        hint: 'Мета-опис за замовчуванням (до 160 символів)',
      },
      {
        key: 'google_analytics_id',
        label: 'Google Analytics ID',
        hint: 'Формат: G-XXXXXXXXXX або UA-XXXXXXXX-X',
        validate: (v) =>
          v && !/^(G-[A-Z0-9]+|UA-\d+-\d+)$/.test(v) ? 'Невірний формат GA ID' : null,
      },
      {
        key: 'facebook_pixel_id',
        label: 'Facebook Pixel ID',
        hint: 'Числовий ID з кабінету Meta Ads',
        validate: (v) => (v && !/^\d+$/.test(v) ? 'Pixel ID має бути числом' : null),
      },
      {
        key: 'pinterest_tag_id',
        label: 'Pinterest Tag ID',
        hint: 'ID з Pinterest Business → Conversions → Pinterest Tag (13-значне число)',
        validate: (v) => (v && !/^\d{10,20}$/.test(v) ? 'Tag ID має бути числом 10-20 цифр' : null),
      },
      {
        key: 'pinterest_domain_verify',
        label: 'Pinterest Domain Verify',
        hint: 'Значення з meta-тега <meta name="p:domain_verify"> у Pinterest Business → Claim domain',
        validate: (v) => (v && !/^[a-f0-9]{32}$/i.test(v) ? 'Має бути 32 hex-символи' : null),
      },
    ],
  },
  {
    key: 'loyalty',
    label: 'Лояльність / Реферали',
    fields: [
      {
        key: 'loyalty_welcome_bonus',
        label: 'Вітальний бонус (балів)',
        hint: 'Нараховується одразу при реєстрації будь-якого нового користувача. 0 — вимкнено. 1 бал = 1 ₴ знижки.',
        validate: (v) => (v && !/^\d+$/.test(v) ? 'Має бути цілим числом (0 — вимкнено)' : null),
      },
      {
        key: 'referral_referrer_bonus',
        label: 'Бонус рефереру (балів)',
        hint: 'Скільки балів отримує запрошуючий, коли друг зробить перше замовлення. 0 — вимкнено.',
        validate: (v) => (v && !/^\d+$/.test(v) ? 'Має бути цілим числом (0 — вимкнено)' : null),
      },
      {
        key: 'referral_referee_bonus',
        label: 'Бонус новачку за реферал (балів)',
        hint: 'Додаткові бали для нового користувача, який зареєструвався за чужим реф-кодом — нараховуються при першому замовленні. 0 — вимкнено.',
        validate: (v) => (v && !/^\d+$/.test(v) ? 'Має бути цілим числом (0 — вимкнено)' : null),
      },
      {
        key: 'loyalty_max_redemption_percent',
        label: 'Макс. % замовлення, оплачуваний балами',
        hint: 'Скільки % суми замовлення (товари + доставка) клієнт може оплатити балами. 50 — половина, 100 — все. 0 — без обмеження.',
        validate: (v) => {
          if (!v) return null;
          if (!/^\d+$/.test(v)) return 'Має бути цілим числом 0-100';
          const n = Number(v);
          if (n < 0 || n > 100) return 'Діапазон 0-100';
          return null;
        },
      },
    ],
  },
];

export default function AdminSettingsPage() {
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
      toast.error('Виправте помилки перед збереженням');
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
      toast.success('Налаштування збережено');
    } else {
      toast.error(res.error || 'Помилка збереження');
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
        <h2 className="text-xl font-bold">Налаштування сайту</h2>
        {activeSection !== 'delivery' && activeSection !== 'ai' && (
          <Button onClick={handleSaveClick} isLoading={isSaving}>
            Зберегти
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
          Палетна доставка
        </button>
        <button
          onClick={() => {
            setActiveSection('ai');
            setFieldErrors({});
          }}
          className={`rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${activeSection === 'ai' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
        >
          AI (Claude / Gemini)
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
        title="Зберегти налаштування"
        message="Ви впевнені, що хочете зберегти зміни в налаштуваннях сайту? Зміни набудуть чинності відразу."
        confirmText="Так, зберегти"
      />
    </div>
  );
}

function PalletDeliverySettings() {
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
      toast.success('Налаштування палетної доставки збережено');
    } else {
      toast.error('Помилка збереження');
    }
  }, [config]);

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
        <h3 className="text-lg font-semibold">Палетна доставка</h3>
        <Button onClick={() => setConfirmSave(true)} isLoading={isSaving}>
          Зберегти
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
          Увімкнено
        </label>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Input
          label="Мін. вага (кг)"
          type="number"
          value={String(config.minWeightKg)}
          onChange={(e) => updateField('minWeightKg', Number(e.target.value))}
        />
        <Input
          label="Макс. вага (кг)"
          type="number"
          value={String(config.maxWeightKg)}
          onChange={(e) => updateField('maxWeightKg', Number(e.target.value))}
        />
        <Input
          label="Базова ціна (грн)"
          type="number"
          value={String(config.basePrice)}
          onChange={(e) => updateField('basePrice', Number(e.target.value))}
        />
        <Input
          label="Ціна за кг (грн)"
          type="number"
          value={String(config.pricePerKg)}
          onChange={(e) => updateField('pricePerKg', Number(e.target.value))}
        />
        <Input
          label="Безкоштовно від (грн)"
          type="number"
          value={String(config.freeDeliveryThreshold)}
          onChange={(e) => updateField('freeDeliveryThreshold', Number(e.target.value))}
        />
        <Input
          label="Орієнтовний термін"
          value={config.estimatedDays}
          onChange={(e) => updateField('estimatedDays', e.target.value)}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Регіони</h4>
          <button
            type="button"
            onClick={addRegion}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            + Додати регіон
          </button>
        </div>
        <div className="space-y-2">
          {config.regions.map((region, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={region.name}
                onChange={(e) => updateRegion(i, 'name', e.target.value)}
                placeholder="Назва регіону"
              />
              <Input
                type="number"
                value={String(region.multiplier)}
                onChange={(e) => updateRegion(i, 'multiplier', Number(e.target.value))}
                placeholder="Множник"
              />
              <button
                type="button"
                onClick={() => removeRegion(i)}
                className="shrink-0 text-xs text-[var(--color-danger)] hover:underline"
              >
                Видалити
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={handleSaveConfirm}
        title="Зберегти налаштування доставки"
        message="Зміни в налаштуваннях палетної доставки набудуть чинності відразу."
        confirmText="Так, зберегти"
      />
    </div>
  );
}

// Google retired Gemini 1.5 models in late 2025 — keep this list to the
// currently-available ones. If a deprecated value is read from DB we coerce
// it back to the default on form load.
const GEMINI_MODELS: { value: string; label: string }[] = [
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (рекомендована)' },
  { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (найдешевша)' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (якість)' },
  { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { value: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
];
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

function AISettings() {
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
          const isValid = GEMINI_MODELS.some((m) => m.value === saved);
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
      toast.success('Налаштування AI збережено');
    } else {
      toast.error(res.error || 'Помилка збереження');
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
        toast.success(`${provider === 'claude' ? 'Claude' : 'Gemini'} — підключення працює ✓`);
      } else {
        toast.error(res.error || 'Підключення не вдалося');
      }
    } catch {
      toast.error('Помилка мережі');
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
        <h3 className="text-lg font-semibold">AI — генерація описів і SEO</h3>
        <Button onClick={() => setConfirmSave(true)} isLoading={isSaving}>
          Зберегти
        </Button>
      </div>

      <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
        Ключі зберігаються в БД і мають пріоритет над відповідними змінними середовища
        (ANTHROPIC_API_KEY / GEMINI_API_KEY). Якщо поле порожнє — береться значення з .env.
        Збережені ключі маскуються (••••XXXX) при наступному завантаженні; залиште маску, щоб не
        змінювати ключ.
      </p>

      <div className="space-y-5">
        {/* Claude */}
        <div className="rounded-md border border-[var(--color-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Claude (Anthropic)</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Найкраща якість, ~$0.02 за генерацію. Отримати ключ:{' '}
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
              Перевірити
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
              <p className="text-sm font-semibold">Gemini (Google)</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Дешева альтернатива (~$0.0005 на gemini-1.5-flash). Отримати ключ:{' '}
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
              Перевірити
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
              <label className="mb-1 block text-sm font-medium">Модель</label>
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
        title="Зберегти налаштування AI"
        message="Зміни набудуть чинності відразу. Якщо ви залишили маску (••••), збережений ключ не зміниться."
        confirmText="Так, зберегти"
      />
    </div>
  );
}
