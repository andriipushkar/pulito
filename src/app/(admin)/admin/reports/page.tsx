'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface ReportTemplate {
  key: string;
  label: string;
  description: string;
  fields: { name: string; label: string; type: 'date' | 'select'; options?: { value: string; label: string }[] }[];
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    key: 'sales_summary',
    label: 'Звіт про продажі',
    description: 'Загальна статистика продажів за обраний період',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'products_stock',
    label: 'Залишки товарів',
    description: 'Звіт по залишках та руху товарів',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'orders_by_status',
    label: 'Замовлення за статусом',
    description: 'Розбивка замовлень за статусами за обраний період',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
      {
        name: 'status', label: 'Статус', type: 'select',
        options: [
          { value: '', label: 'Всі' },
          { value: 'new_order', label: 'Нові' },
          { value: 'processing', label: 'В обробці' },
          { value: 'confirmed', label: 'Підтверджені' },
          { value: 'shipped', label: 'Відправлені' },
          { value: 'completed', label: 'Завершені' },
          { value: 'cancelled', label: 'Скасовані' },
        ],
      },
    ],
  },
  {
    key: 'clients_activity',
    label: 'Активність клієнтів',
    description: 'Звіт по активності клієнтів: замовлення, реєстрації, повернення',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'wholesale_report',
    label: 'Оптові продажі',
    description: 'Деталізований звіт по оптових замовленнях та клієнтах',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'delivery_report',
    label: 'Звіт по доставках',
    description: 'Статистика доставок: методи, час, вартість',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'financial_report',
    label: 'Фінансовий звіт',
    description: 'Виручка, знижки, витрати на доставку, чистий дохід за період',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'returns_cancellations',
    label: 'Повернення та скасування',
    description: 'Причини, суми та частота повернень і скасувань замовлень',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'wholesale_groups',
    label: 'Звіт по оптових групах',
    description: 'Порівняння груп: Дрібний опт, Середній опт, Великий опт',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'product_leaders',
    label: 'Товари-лідери та аутсайдери',
    description: 'Найпопулярніші та найменш продавані товари з конверсією',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'manager_activity',
    label: 'Активність менеджерів',
    description: 'Кількість оброблених замовлень та дій кожного менеджера',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'acquisition_channels',
    label: 'Канали залучення',
    description: 'UTM-джерела, конверсія та виручка по каналах залучення',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
  {
    key: 'summary_report',
    label: 'Зведений звіт',
    description: 'Ключові метрики з усіх розділів в одному звіті',
    fields: [
      { name: 'dateFrom', label: 'Дата з', type: 'date' },
      { name: 'dateTo', label: 'Дата по', type: 'date' },
    ],
  },
];

type ReportView = 'templates' | 'custom';

const CUSTOM_REPORT_ENTITIES = [
  { value: 'orders', label: 'Замовлення' },
  { value: 'products', label: 'Товари' },
  { value: 'users', label: 'Користувачі' },
];

const CUSTOM_REPORT_FIELDS: Record<string, { key: string; label: string }[]> = {
  orders: [
    { key: 'orderNumber', label: 'Номер замовлення' },
    { key: 'createdAt', label: 'Дата створення' },
    { key: 'status', label: 'Статус' },
    { key: 'totalAmount', label: 'Сума' },
    { key: 'deliveryMethod', label: 'Доставка' },
    { key: 'paymentMethod', label: 'Оплата' },
    { key: 'clientName', label: 'Клієнт' },
    { key: 'clientEmail', label: 'Email клієнта' },
    { key: 'clientPhone', label: 'Телефон клієнта' },
    { key: 'itemsCount', label: 'Кількість товарів' },
    { key: 'discountAmount', label: 'Знижка' },
    { key: 'deliveryCost', label: 'Вартість доставки' },
    { key: 'notes', label: 'Примітки' },
  ],
  products: [
    { key: 'code', label: 'Код товару' },
    { key: 'name', label: 'Назва' },
    { key: 'slug', label: 'Slug' },
    { key: 'priceRetail', label: 'Роздрібна ціна' },
    { key: 'priceWholesale', label: 'Оптова ціна' },
    { key: 'quantity', label: 'Залишок' },
    { key: 'category', label: 'Категорія' },
    { key: 'isActive', label: 'Активний' },
    { key: 'isPromo', label: 'Акційний' },
    { key: 'weight', label: 'Вага' },
    { key: 'ordersCount', label: 'Кількість замовлень' },
  ],
  users: [
    { key: 'email', label: 'Email' },
    { key: 'fullName', label: 'ПІБ' },
    { key: 'phone', label: 'Телефон' },
    { key: 'role', label: 'Роль' },
    { key: 'createdAt', label: 'Дата реєстрації' },
    { key: 'ordersCount', label: 'Кількість замовлень' },
    { key: 'totalSpent', label: 'Загальна сума' },
    { key: 'wholesaleGroup', label: 'Оптова група' },
    { key: 'companyName', label: 'Компанія' },
    { key: 'isBlocked', label: 'Заблокований' },
  ],
};

export default function AdminReportsPage() {
  const [view, setView] = useState<ReportView>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Custom report state
  const [customEntity, setCustomEntity] = useState('orders');
  const [customFields, setCustomFields] = useState<Set<string>>(new Set());
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [customStatus, setCustomStatus] = useState('');

  const handleSelect = (tpl: ReportTemplate) => {
    setSelectedTemplate(tpl);
    setFormValues({});
    setDownloadUrl(null);
    setError(null);
  };

  const handleGenerate = async (format: 'xlsx' | 'csv' | 'pdf') => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const res = await apiClient.post<{ url: string }>('/api/v1/admin/reports/generate', {
        templateKey: selectedTemplate.key,
        format,
        params: formValues,
      });
      if (res.success && res.data?.url) {
        setDownloadUrl(res.data.url);
        window.open(res.data.url, '_blank');
      } else {
        setError(res.error || 'Помилка генерації звіту');
      }
    } catch {
      setError('Помилка мережі');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCustomField = useCallback((key: string) => {
    setCustomFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllFields = useCallback(() => {
    const fields = CUSTOM_REPORT_FIELDS[customEntity] || [];
    setCustomFields(new Set(fields.map((f) => f.key)));
  }, [customEntity]);

  const handleCustomGenerate = async (format: 'xlsx' | 'csv') => {
    if (customFields.size === 0) return;
    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const res = await apiClient.post<{ url: string }>('/api/v1/admin/reports/generate', {
        templateKey: 'custom',
        format,
        params: {
          entity: customEntity,
          fields: Array.from(customFields),
          dateFrom: customDateFrom,
          dateTo: customDateTo,
          status: customStatus,
        },
      });
      if (res.success && res.data?.url) {
        setDownloadUrl(res.data.url);
        window.open(res.data.url, '_blank');
      } else {
        setError(res.error || 'Помилка генерації звіту');
      }
    } catch {
      setError('Помилка мережі');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Звіти</h2>
        <div className="flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1">
          <button
            onClick={() => setView('templates')}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${view === 'templates' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            Шаблони
          </button>
          <button
            onClick={() => setView('custom')}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${view === 'custom' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            Конструктор
          </button>
        </div>
      </div>

      {view === 'templates' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Template list */}
          <div className="space-y-2 lg:col-span-1">
            {REPORT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => handleSelect(tpl)}
                className={`w-full rounded-[var(--radius)] border p-4 text-left transition-colors ${
                  selectedTemplate?.key === tpl.key
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                <p className="text-sm font-semibold">{tpl.label}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{tpl.description}</p>
              </button>
            ))}
          </div>

          {/* Report form */}
          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
                <h3 className="mb-4 text-lg font-semibold">{selectedTemplate.label}</h3>
                <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{selectedTemplate.description}</p>

                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.name}>
                      {field.type === 'date' ? (
                        <Input
                          label={field.label}
                          type="date"
                          value={formValues[field.name] || ''}
                          onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                        />
                      ) : field.type === 'select' && field.options ? (
                        <div>
                          <label className="mb-1 block text-sm font-medium">{field.label}</label>
                          <Select
                            options={field.options}
                            value={formValues[field.name] || ''}
                            onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleGenerate('xlsx')} isLoading={isGenerating}>Завантажити XLSX</Button>
                  <Button variant="outline" onClick={() => handleGenerate('csv')} isLoading={isGenerating}>CSV</Button>
                  <Button variant="outline" onClick={() => handleGenerate('pdf')} isLoading={isGenerating}>PDF</Button>
                </div>

                {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
                {downloadUrl && (
                  <p className="mt-3 text-sm text-green-600">
                    Звіт згенеровано.{' '}
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">Завантажити</a>
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-[var(--color-text-secondary)]">
                Оберіть шаблон звіту зліва
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Custom report builder */
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-4 text-lg font-semibold">Конструктор звітів</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Оберіть сутність, поля та фільтри для створення власного звіту
          </p>

          {/* Entity selection */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">Сутність</label>
            <div className="flex gap-2">
              {CUSTOM_REPORT_ENTITIES.map((e) => (
                <button
                  key={e.value}
                  onClick={() => { setCustomEntity(e.value); setCustomFields(new Set()); }}
                  className={`rounded-[var(--radius)] border px-4 py-2 text-sm font-medium transition-colors ${
                    customEntity === e.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Field selection */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Поля ({customFields.size} обрано)</label>
              <button onClick={selectAllFields} className="text-xs text-[var(--color-primary)] hover:underline">Обрати всі</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(CUSTOM_REPORT_FIELDS[customEntity] || []).map((field) => (
                <label
                  key={field.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors ${
                    customFields.has(field.key)
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={customFields.has(field.key)}
                    onChange={() => toggleCustomField(field.key)}
                    className="accent-[var(--color-primary)]"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">Фільтри</label>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Дата з" type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} />
              <Input label="Дата по" type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} />
              {customEntity === 'orders' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Статус</label>
                  <Select
                    options={[
                      { value: '', label: 'Всі' },
                      { value: 'new_order', label: 'Нові' },
                      { value: 'processing', label: 'В обробці' },
                      { value: 'confirmed', label: 'Підтверджені' },
                      { value: 'shipped', label: 'Відправлені' },
                      { value: 'completed', label: 'Завершені' },
                      { value: 'cancelled', label: 'Скасовані' },
                    ]}
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Generate */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleCustomGenerate('xlsx')} isLoading={isGenerating} disabled={customFields.size === 0}>
              Завантажити XLSX
            </Button>
            <Button variant="outline" onClick={() => handleCustomGenerate('csv')} isLoading={isGenerating} disabled={customFields.size === 0}>
              CSV
            </Button>
          </div>

          {customFields.size === 0 && (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Оберіть хоча б одне поле для генерації звіту</p>
          )}

          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
          {downloadUrl && (
            <p className="mt-3 text-sm text-green-600">
              Звіт згенеровано.{' '}
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">Завантажити</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
