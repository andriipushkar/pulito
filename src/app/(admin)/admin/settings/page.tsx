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

type SectionKey = 'general' | 'company' | 'social' | 'analytics' | 'delivery';

const SECTIONS: { key: SectionKey; label: string; fields: { key: string; label: string; hint?: string; validate?: (v: string) => string | null }[] }[] = [
  {
    key: 'general',
    label: 'Загальні',
    fields: [
      { key: 'site_name', label: 'Назва сайту', hint: 'Відображається у заголовку браузера та листах' },
      {
        key: 'site_phone',
        label: 'Телефон',
        hint: 'Формат: +380XXXXXXXXX',
        validate: (v) => v && !PHONE_UA_PATTERN.test(v) ? 'Невірний формат. Використовуйте +380XXXXXXXXX' : null,
      },
      { key: 'site_email', label: 'Email', hint: 'Основний email для листів від клієнтів',
        validate: (v) => v && !v.includes('@') ? 'Невірний формат email' : null,
      },
      { key: 'site_address', label: 'Адреса', hint: 'Фізична адреса для контактної сторінки' },
      { key: 'working_hours', label: 'Графік роботи', hint: 'Наприклад: Пн-Пт 9:00-18:00' },
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
        validate: (v) => v && !EDRPOU_PATTERN.test(v) ? 'ЄДРПОУ має містити рівно 8 цифр' : null,
      },
      {
        key: 'company_ipn',
        label: 'ІПН',
        hint: '10- або 12-значний податковий номер',
        validate: (v) => v && !IPN_PATTERN.test(v) ? 'ІПН має містити 10 або 12 цифр' : null,
      },
      {
        key: 'company_iban',
        label: 'IBAN',
        hint: 'UA + 27 цифр — банківський рахунок для оплат',
        validate: (v) => v && !IBAN_UA_PATTERN.test(v) ? 'IBAN має починатися з UA та містити 29 символів' : null,
      },
      { key: 'company_bank', label: 'Банк', hint: 'Назва банку для реквізитів в рахунках' },
      { key: 'company_legal_address', label: 'Юридична адреса' },
    ],
  },
  {
    key: 'social',
    label: 'Соціальні мережі',
    fields: [
      { key: 'telegram_channel', label: 'Telegram канал', hint: 'Посилання виду https://t.me/channel' },
      { key: 'viber_community', label: 'Viber спільнота', hint: 'Повне посилання на спільноту Viber' },
      { key: 'facebook_url', label: 'Facebook URL', hint: 'Повне посилання на сторінку Facebook' },
      { key: 'instagram_url', label: 'Instagram URL', hint: 'Повне посилання на профіль Instagram' },
    ],
  },
  {
    key: 'analytics',
    label: 'SEO та аналітика',
    fields: [
      { key: 'default_seo_title', label: 'SEO Title (за замовч.)', hint: 'Заголовок для сторінок без власного SEO-title (до 70 символів)' },
      { key: 'default_seo_description', label: 'SEO Description (за замовч.)', hint: 'Мета-опис за замовчуванням (до 160 символів)' },
      {
        key: 'google_analytics_id',
        label: 'Google Analytics ID',
        hint: 'Формат: G-XXXXXXXXXX або UA-XXXXXXXX-X',
        validate: (v) => v && !/^(G-[A-Z0-9]+|UA-\d+-\d+)$/.test(v) ? 'Невірний формат GA ID' : null,
      },
      { key: 'facebook_pixel_id', label: 'Facebook Pixel ID', hint: 'Числовий ID з кабінету Meta Ads',
        validate: (v) => v && !/^\d+$/.test(v) ? 'Pixel ID має бути числом' : null,
      },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey | 'delivery'>('general');
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
    setIsSaving(false);
    if (res.success) {
      toast.success('Налаштування збережено');
    } else {
      toast.error('Помилка збереження');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Налаштування сайту</h2>
        {activeSection !== 'delivery' && (
          <Button onClick={handleSaveClick} isLoading={isSaving}>Зберегти</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => { setActiveSection(s.key); setFieldErrors({}); }}
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
      </div>

      {/* Section content */}
      {activeSection === 'delivery' ? (
        <PalletDeliverySettings />
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-4 text-lg font-semibold">
            {SECTIONS.find((s) => s.key === activeSection)?.label}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {SECTIONS.find((s) => s.key === activeSection)?.fields.map((field) => (
              <div key={field.key}>
                <Input
                  label={field.label}
                  value={settings[field.key] || ''}
                  onChange={(e) => {
                    setSettings((prev) => ({ ...prev, [field.key]: e.target.value }));
                    if (fieldErrors[field.key]) {
                      setFieldErrors((prev) => { const next = { ...prev }; delete next[field.key]; return next; });
                    }
                  }}
                  error={fieldErrors[field.key]}
                />
                {field.hint && (
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{field.hint}</p>
                )}
              </div>
            ))}
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
    setConfig((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const updateRegion = useCallback((index: number, field: keyof PalletRegion, value: string | number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const regions = [...prev.regions];
      regions[index] = { ...regions[index], [field]: value };
      return { ...prev, regions };
    });
  }, []);

  const addRegion = useCallback(() => {
    setConfig((prev) => prev ? { ...prev, regions: [...prev.regions, { name: '', multiplier: 1 }] } : prev);
  }, []);

  const removeRegion = useCallback((index: number) => {
    setConfig((prev) => prev ? { ...prev, regions: prev.regions.filter((_, i) => i !== index) } : prev);
  }, []);

  if (isLoading) return <div className="flex justify-center py-8"><Spinner size="md" /></div>;
  if (!config) return null;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Палетна доставка</h3>
        <Button onClick={() => setConfirmSave(true)} isLoading={isSaving}>Зберегти</Button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.enabled} onChange={(e) => updateField('enabled', e.target.checked)} className="accent-[var(--color-primary)]" />
          Увімкнено
        </label>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Input label="Мін. вага (кг)" type="number" value={String(config.minWeightKg)} onChange={(e) => updateField('minWeightKg', Number(e.target.value))} />
        <Input label="Макс. вага (кг)" type="number" value={String(config.maxWeightKg)} onChange={(e) => updateField('maxWeightKg', Number(e.target.value))} />
        <Input label="Базова ціна (грн)" type="number" value={String(config.basePrice)} onChange={(e) => updateField('basePrice', Number(e.target.value))} />
        <Input label="Ціна за кг (грн)" type="number" value={String(config.pricePerKg)} onChange={(e) => updateField('pricePerKg', Number(e.target.value))} />
        <Input label="Безкоштовно від (грн)" type="number" value={String(config.freeDeliveryThreshold)} onChange={(e) => updateField('freeDeliveryThreshold', Number(e.target.value))} />
        <Input label="Орієнтовний термін" value={config.estimatedDays} onChange={(e) => updateField('estimatedDays', e.target.value)} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Регіони</h4>
          <button type="button" onClick={addRegion} className="text-xs text-[var(--color-primary)] hover:underline">+ Додати регіон</button>
        </div>
        <div className="space-y-2">
          {config.regions.map((region, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={region.name} onChange={(e) => updateRegion(i, 'name', e.target.value)} placeholder="Назва регіону" />
              <Input type="number" value={String(region.multiplier)} onChange={(e) => updateRegion(i, 'multiplier', Number(e.target.value))} placeholder="Множник" />
              <button type="button" onClick={() => removeRegion(i)} className="shrink-0 text-xs text-[var(--color-danger)] hover:underline">Видалити</button>
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
