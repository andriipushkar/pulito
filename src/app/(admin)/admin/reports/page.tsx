'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface ReportTemplate {
  key: string;
  label: string;
  description: string;
  fields: {
    name: string;
    label: string;
    type: 'date' | 'select';
    options?: { value: string; label: string }[];
  }[];
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
        name: 'status',
        label: 'Статус',
        type: 'select',
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
    label: 'Гуртові продажі',
    description: 'Деталізований звіт по гуртових замовленнях та клієнтах',
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
    label: 'Звіт по гуртових групах',
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

type ReportView = 'templates' | 'custom' | 'subscriptions';

const SUBSCRIPTION_REPORT_TYPES: { value: string; label: string }[] = [
  { value: 'dashboard_summary', label: 'Зведення (KPI)' },
  { value: 'sales_summary', label: 'Продажі' },
  { value: 'orders_by_status', label: 'Замовлення за статусом' },
  { value: 'products_stock', label: 'Залишки товарів' },
  { value: 'clients_activity', label: 'Активність клієнтів' },
  { value: 'financial_report', label: 'Фінансовий звіт' },
];

const SUBSCRIPTION_SCHEDULES: { value: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
  { value: 'daily', label: 'Щодня' },
  { value: 'weekly', label: 'Щотижня (понеділок)' },
  { value: 'monthly', label: 'Щомісяця (1-го числа)' },
];

interface EmailSubscription {
  id: number;
  reportType: string;
  schedule: string | null;
  scheduleEmail: string | null;
  createdAt: string;
}

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
    { key: 'priceWholesale', label: 'Гуртова ціна' },
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
    { key: 'wholesaleGroup', label: 'Гуртова група' },
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

  // Email subscriptions
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [subReportType, setSubReportType] = useState('dashboard_summary');
  const [subSchedule, setSubSchedule] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [subEmail, setSubEmail] = useState('');
  const [isSubLoading, setIsSubLoading] = useState(false);

  const loadSubscriptions = useCallback(() => {
    apiClient.get<EmailSubscription[]>('/api/v1/admin/reports/subscriptions').then((res) => {
      if (res.success && res.data) setSubscriptions(res.data);
    });
  }, []);

  useEffect(() => {
    if (view === 'subscriptions') loadSubscriptions();
  }, [view, loadSubscriptions]);

  const handleSubscribe = async () => {
    setIsSubLoading(true);
    const res = await apiClient.post('/api/v1/admin/reports/subscriptions', {
      reportType: subReportType,
      schedule: subSchedule,
      email: subEmail.trim() || undefined,
    });
    setIsSubLoading(false);
    if (res.success) {
      toast.success('Підписку збережено');
      setSubEmail('');
      loadSubscriptions();
    } else {
      toast.error(res.error || 'Не вдалося зберегти підписку');
    }
  };

  const handleUnsubscribe = async (id: number) => {
    const res = await apiClient.delete(`/api/v1/admin/reports/subscriptions/${id}`);
    if (res.success) {
      toast.success('Підписку видалено');
      loadSubscriptions();
    } else {
      toast.error(res.error || 'Не вдалося видалити підписку');
    }
  };

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

  const applyDatePreset = useCallback(
    (preset: 'today' | 'week' | 'month' | 'year', target: 'template' | 'custom') => {
      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const to = iso(today);
      const from = new Date(today);
      if (preset === 'today') {
        // from = today
      } else if (preset === 'week') from.setDate(today.getDate() - 6);
      else if (preset === 'month') from.setDate(today.getDate() - 29);
      else if (preset === 'year') from.setFullYear(today.getFullYear() - 1);

      const fromIso = iso(from);
      if (target === 'template') {
        setFormValues((prev) => ({ ...prev, dateFrom: fromIso, dateTo: to }));
      } else {
        setCustomDateFrom(fromIso);
        setCustomDateTo(to);
      }
    },
    [],
  );

  const dateRangeError =
    formValues.dateFrom && formValues.dateTo && formValues.dateFrom > formValues.dateTo
      ? "Дата 'з' має бути не пізніше за дату 'по'"
      : null;

  const customDateRangeError =
    customDateFrom && customDateTo && customDateFrom > customDateTo
      ? "Дата 'з' має бути не пізніше за дату 'по'"
      : null;

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
          <button
            onClick={() => setView('subscriptions')}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${view === 'subscriptions' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            📬 Підписки
          </button>
        </div>
      </div>

      {view === 'subscriptions' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h3 className="mb-3 text-sm font-semibold">Нова підписка</h3>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Звіт надсилається на email автоматично за обраним розкладом.
            </p>
            <div className="space-y-3">
              <Select
                label="Тип звіту"
                value={subReportType}
                onChange={(e) => setSubReportType(e.target.value)}
                options={SUBSCRIPTION_REPORT_TYPES}
              />
              <Select
                label="Розклад"
                value={subSchedule}
                onChange={(e) => setSubSchedule(e.target.value as 'daily' | 'weekly' | 'monthly')}
                options={SUBSCRIPTION_SCHEDULES}
              />
              <Input
                label="Email (порожнє — на ваш login email)"
                placeholder="manager@example.com"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
              />
              <Button onClick={handleSubscribe} isLoading={isSubLoading} className="w-full">
                Підписатися
              </Button>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h3 className="mb-3 text-sm font-semibold">Активні підписки</h3>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                У вас ще немає активних підписок на email-звіти.
              </p>
            ) : (
              <ul className="space-y-2">
                {subscriptions.map((s) => {
                  const reportLabel =
                    SUBSCRIPTION_REPORT_TYPES.find((t) => t.value === s.reportType)?.label ||
                    s.reportType;
                  const scheduleLabel =
                    SUBSCRIPTION_SCHEDULES.find((sc) => sc.value === s.schedule)?.label ||
                    s.schedule;
                  return (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{reportLabel}</p>
                        <p className="truncate text-xs text-[var(--color-text-secondary)]">
                          {scheduleLabel} · {s.scheduleEmail}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnsubscribe(s.id)}
                        className="shrink-0 text-xs text-[var(--color-danger)] hover:underline"
                      >
                        Відписатись
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === 'subscriptions' ? null : view === 'templates' ? (
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
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {tpl.description}
                </p>
              </button>
            ))}
          </div>

          {/* Report form */}
          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
                <h3 className="mb-4 text-lg font-semibold">{selectedTemplate.label}</h3>
                <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                  {selectedTemplate.description}
                </p>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  <DatePresetButton onClick={() => applyDatePreset('today', 'template')} label="Сьогодні" />
                  <DatePresetButton onClick={() => applyDatePreset('week', 'template')} label="Тиждень" />
                  <DatePresetButton onClick={() => applyDatePreset('month', 'template')} label="Місяць" />
                  <DatePresetButton onClick={() => applyDatePreset('year', 'template')} label="Рік" />
                </div>

                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.name}>
                      {field.type === 'date' ? (
                        <Input
                          label={field.label}
                          type="date"
                          value={formValues[field.name] || ''}
                          onChange={(e) =>
                            setFormValues({ ...formValues, [field.name]: e.target.value })
                          }
                        />
                      ) : field.type === 'select' && field.options ? (
                        <div>
                          <label className="mb-1 block text-sm font-medium">{field.label}</label>
                          <Select
                            options={field.options}
                            value={formValues[field.name] || ''}
                            onChange={(e) =>
                              setFormValues({ ...formValues, [field.name]: e.target.value })
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {dateRangeError && (
                  <p className="mb-3 text-sm text-[var(--color-danger)]">{dateRangeError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleGenerate('xlsx')}
                    isLoading={isGenerating}
                    disabled={!!dateRangeError}
                  >
                    Завантажити XLSX
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate('csv')}
                    isLoading={isGenerating}
                    disabled={!!dateRangeError}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate('pdf')}
                    isLoading={isGenerating}
                    disabled={!!dateRangeError}
                  >
                    PDF
                  </Button>
                </div>

                {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
                {downloadUrl && (
                  <p className="mt-3 text-sm text-green-600">
                    Звіт згенеровано.{' '}
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Завантажити
                    </a>
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
                  onClick={() => {
                    setCustomEntity(e.value);
                    setCustomFields(new Set());
                  }}
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
              <div className="flex items-center gap-3">
                {customFields.size > 0 && (
                  <button
                    onClick={() => setCustomFields(new Set())}
                    className="text-xs text-[var(--color-text-secondary)] hover:underline"
                  >
                    Очистити
                  </button>
                )}
                <button
                  onClick={selectAllFields}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  Обрати всі
                </button>
              </div>
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
            <div className="mb-3 flex flex-wrap gap-1.5">
              <DatePresetButton onClick={() => applyDatePreset('today', 'custom')} label="Сьогодні" />
              <DatePresetButton onClick={() => applyDatePreset('week', 'custom')} label="Тиждень" />
              <DatePresetButton onClick={() => applyDatePreset('month', 'custom')} label="Місяць" />
              <DatePresetButton onClick={() => applyDatePreset('year', 'custom')} label="Рік" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Дата з"
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
              />
              <Input
                label="Дата по"
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
              />
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

          {customDateRangeError && (
            <p className="mb-3 text-sm text-[var(--color-danger)]">{customDateRangeError}</p>
          )}

          {/* Generate */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleCustomGenerate('xlsx')}
              isLoading={isGenerating}
              disabled={customFields.size === 0 || !!customDateRangeError}
            >
              Завантажити XLSX
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCustomGenerate('csv')}
              isLoading={isGenerating}
              disabled={customFields.size === 0 || !!customDateRangeError}
            >
              CSV
            </Button>
          </div>

          {customFields.size === 0 && (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Оберіть хоча б одне поле для генерації звіту
            </p>
          )}

          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
          {downloadUrl && (
            <p className="mt-3 text-sm text-green-600">
              Звіт згенеровано.{' '}
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Завантажити
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DatePresetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
    >
      {label}
    </button>
  );
}
