'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

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

const SECTIONS: { key: SectionKey; label: string; fields: { key: string; label: string; hint?: string }[] }[] = [
  {
    key: 'general',
    label: 'Загальні',
    fields: [
      { key: 'site_name', label: 'Назва сайту', hint: 'Відображається у заголовку браузера та листах' },
      { key: 'site_phone', label: 'Телефон', hint: 'Формат: +380XXXXXXXXX' },
      { key: 'site_email', label: 'Email', hint: 'Основний email для листів від клієнтів' },
      { key: 'site_address', label: 'Адреса', hint: 'Фізична адреса для контактної сторінки' },
      { key: 'working_hours', label: 'Графік роботи', hint: 'Наприклад: Пн-Пт 9:00-18:00' },
    ],
  },
  {
    key: 'company',
    label: 'Юридична інформація',
    fields: [
      { key: 'company_legal_name', label: 'Юридична назва', hint: 'Повна назва ФОП або ТОВ' },
      { key: 'company_edrpou', label: 'ЄДРПОУ', hint: '8-значний код з ЄДР' },
      { key: 'company_ipn', label: 'ІПН', hint: '10- або 12-значний податковий номер' },
      { key: 'company_iban', label: 'IBAN', hint: 'UA + 27 цифр — банківський рахунок для оплат' },
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
      { key: 'google_analytics_id', label: 'Google Analytics ID', hint: 'Формат: G-XXXXXXXXXX або UA-XXXXXXXX-X' },
      { key: 'facebook_pixel_id', label: 'Facebook Pixel ID', hint: 'Числовий ID з кабінету Meta Ads' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<SectionKey | 'delivery'>('general');

  useEffect(() => {
    apiClient
      .get<Record<string, string>>('/api/v1/admin/settings')
      .then((res) => {
        if (res.success && res.data) setSettings(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    const res = await apiClient.put('/api/v1/admin/settings', settings);
    setIsSaving(false);
    setMessage(res.success ? 'Збережено' : 'Помилка збереження');
    setTimeout(() => setMessage(''), 3000);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Налаштування сайту</h2>
        {activeSection !== 'delivery' && (
          <Button onClick={handleSave} isLoading={isSaving}>Зберегти</Button>
        )}
      </div>

      {message && (
        <div className={`mb-4 rounded-[var(--radius)] px-4 py-2 text-sm ${message === 'Збережено' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
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
                  onChange={(e) => setSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
                {field.hint && (
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{field.hint}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PalletDeliverySettings() {
  const [config, setConfig] = useState<PalletConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiClient
      .get<PalletConfig>('/api/v1/admin/settings/pallet-delivery')
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    setMessage('');
    const res = await apiClient.put('/api/v1/admin/settings/pallet-delivery', config);
    setIsSaving(false);
    setMessage(res.success ? 'Збережено' : 'Помилка збереження');
    setTimeout(() => setMessage(''), 3000);
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
        <Button onClick={handleSave} isLoading={isSaving}>Зберегти</Button>
      </div>

      {message && (
        <div className={`mb-4 rounded-[var(--radius)] px-4 py-2 text-sm ${message === 'Збережено' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

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
    </div>
  );
}
