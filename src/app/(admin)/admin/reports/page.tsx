'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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

type ReportView = 'templates' | 'custom' | 'subscriptions';

interface EmailSubscription {
  id: number;
  reportType: string;
  schedule: string | null;
  scheduleEmail: string | null;
  createdAt: string;
}

export default function AdminReportsPage() {
  const t = useTranslations('admin.reportsPage');
  const REPORT_TEMPLATES: ReportTemplate[] = useMemo(() => {
    const dateFields = [
      { name: 'dateFrom', label: t('dateFrom'), type: 'date' as const },
      { name: 'dateTo', label: t('dateTo'), type: 'date' as const },
    ];
    return [
      {
        key: 'sales_summary',
        label: t('tpl_sales_summary'),
        description: t('tpl_sales_summary_desc'),
        fields: dateFields,
      },
      {
        key: 'products_stock',
        label: t('tpl_products_stock'),
        description: t('tpl_products_stock_desc'),
        fields: dateFields,
      },
      {
        key: 'orders_by_status',
        label: t('tpl_orders_by_status'),
        description: t('tpl_orders_by_status_desc'),
        fields: [
          ...dateFields,
          {
            name: 'status',
            label: t('statusLabel'),
            type: 'select' as const,
            options: [
              { value: '', label: t('statusAll') },
              { value: 'new_order', label: t('statusNew') },
              { value: 'processing', label: t('statusProcessing') },
              { value: 'confirmed', label: t('statusConfirmed') },
              { value: 'shipped', label: t('statusShipped') },
              { value: 'completed', label: t('statusCompleted') },
              { value: 'cancelled', label: t('statusCancelled') },
            ],
          },
        ],
      },
      {
        key: 'clients_activity',
        label: t('tpl_clients_activity'),
        description: t('tpl_clients_activity_desc'),
        fields: dateFields,
      },
      {
        key: 'wholesale_report',
        label: t('tpl_wholesale_report'),
        description: t('tpl_wholesale_report_desc'),
        fields: dateFields,
      },
      {
        key: 'delivery_report',
        label: t('tpl_delivery_report'),
        description: t('tpl_delivery_report_desc'),
        fields: dateFields,
      },
      {
        key: 'financial_report',
        label: t('tpl_financial_report'),
        description: t('tpl_financial_report_desc'),
        fields: dateFields,
      },
      {
        key: 'returns_cancellations',
        label: t('tpl_returns_cancellations'),
        description: t('tpl_returns_cancellations_desc'),
        fields: dateFields,
      },
      {
        key: 'wholesale_groups',
        label: t('tpl_wholesale_groups'),
        description: t('tpl_wholesale_groups_desc'),
        fields: dateFields,
      },
      {
        key: 'product_leaders',
        label: t('tpl_product_leaders'),
        description: t('tpl_product_leaders_desc'),
        fields: dateFields,
      },
      {
        key: 'manager_activity',
        label: t('tpl_manager_activity'),
        description: t('tpl_manager_activity_desc'),
        fields: dateFields,
      },
      {
        key: 'acquisition_channels',
        label: t('tpl_acquisition_channels'),
        description: t('tpl_acquisition_channels_desc'),
        fields: dateFields,
      },
      {
        key: 'summary_report',
        label: t('tpl_summary_report'),
        description: t('tpl_summary_report_desc'),
        fields: dateFields,
      },
    ];
  }, [t]);

  const SUBSCRIPTION_REPORT_TYPES: { value: string; label: string }[] = useMemo(
    () => [
      { value: 'dashboard_summary', label: t('sub_dashboard_summary') },
      { value: 'sales_summary', label: t('sub_sales_summary') },
      { value: 'orders_by_status', label: t('sub_orders_by_status') },
      { value: 'products_stock', label: t('sub_products_stock') },
      { value: 'clients_activity', label: t('sub_clients_activity') },
      { value: 'financial_report', label: t('sub_financial_report') },
    ],
    [t],
  );

  const SUBSCRIPTION_SCHEDULES: { value: 'daily' | 'weekly' | 'monthly'; label: string }[] =
    useMemo(
      () => [
        { value: 'daily', label: t('sched_daily') },
        { value: 'weekly', label: t('sched_weekly') },
        { value: 'monthly', label: t('sched_monthly') },
      ],
      [t],
    );

  const CUSTOM_REPORT_ENTITIES = useMemo(
    () => [
      { value: 'orders', label: t('ent_orders') },
      { value: 'products', label: t('ent_products') },
      { value: 'users', label: t('ent_users') },
    ],
    [t],
  );

  const CUSTOM_REPORT_FIELDS: Record<string, { key: string; label: string }[]> = useMemo(
    () => ({
      orders: [
        { key: 'orderNumber', label: t('f_orderNumber') },
        { key: 'createdAt', label: t('f_createdAt_orders') },
        { key: 'status', label: t('f_status') },
        { key: 'totalAmount', label: t('f_totalAmount') },
        { key: 'deliveryMethod', label: t('f_deliveryMethod') },
        { key: 'paymentMethod', label: t('f_paymentMethod') },
        { key: 'contactName', label: t('f_clientName') },
        { key: 'contactEmail', label: t('f_clientEmail') },
        { key: 'contactPhone', label: t('f_clientPhone') },
        { key: 'itemsCount', label: t('f_itemsCount') },
      ],
      products: [
        { key: 'code', label: t('f_code') },
        { key: 'name', label: t('f_name') },
        { key: 'priceRetail', label: t('f_priceRetail') },
        { key: 'priceWholesale', label: t('f_priceWholesale') },
        { key: 'quantity', label: t('f_quantity') },
        { key: 'categoryName', label: t('f_category') },
        { key: 'isActive', label: t('f_isActive') },
        { key: 'isPromo', label: t('f_isPromo') },
        { key: 'ordersCount', label: t('f_ordersCount') },
      ],
      users: [
        { key: 'email', label: t('f_email') },
        { key: 'fullName', label: t('f_fullName') },
        { key: 'phone', label: t('f_phone') },
        { key: 'role', label: t('f_role') },
        { key: 'createdAt', label: t('f_createdAt_users') },
        { key: 'orderCount', label: t('f_ordersCount') },
        { key: 'totalSpent', label: t('f_totalSpent') },
        { key: 'wholesaleGroup', label: t('f_wholesaleGroup') },
      ],
    }),
    [t],
  );

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
      toast.success(t('subscriptionSaved'));
      setSubEmail('');
      loadSubscriptions();
    } else {
      toast.error(res.error || t('subscriptionSaveError'));
    }
  };

  const handleUnsubscribe = async (id: number) => {
    const res = await apiClient.delete(`/api/v1/admin/reports/subscriptions/${id}`);
    if (res.success) {
      toast.success(t('subscriptionDeleted'));
      loadSubscriptions();
    } else {
      toast.error(res.error || t('subscriptionDeleteError'));
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
        setError(res.error || t('genError'));
      }
    } catch {
      setError(t('networkError'));
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
  }, [customEntity, CUSTOM_REPORT_FIELDS]);

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
      ? t('dateRangeError')
      : null;

  const customDateRangeError =
    customDateFrom && customDateTo && customDateFrom > customDateTo ? t('dateRangeError') : null;

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
        setError(res.error || t('genError'));
      }
    } catch {
      setError(t('networkError'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <div className="flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1">
          <button
            onClick={() => setView('templates')}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${view === 'templates' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            {t('tabTemplates')}
          </button>
          <button
            onClick={() => setView('custom')}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${view === 'custom' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            {t('tabCustom')}
          </button>
          <button
            onClick={() => setView('subscriptions')}
            className={`rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors ${view === 'subscriptions' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            📬 {t('tabSubscriptions')}
          </button>
        </div>
      </div>

      {view === 'subscriptions' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h3 className="mb-3 text-sm font-semibold">{t('newSubscription')}</h3>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              {t('subscriptionHint')}
            </p>
            <div className="space-y-3">
              <Select
                label={t('reportTypeLabel')}
                value={subReportType}
                onChange={(e) => setSubReportType(e.target.value)}
                options={SUBSCRIPTION_REPORT_TYPES}
              />
              <Select
                label={t('scheduleLabel')}
                value={subSchedule}
                onChange={(e) => setSubSchedule(e.target.value as 'daily' | 'weekly' | 'monthly')}
                options={SUBSCRIPTION_SCHEDULES}
              />
              <Input
                label={t('emailLabel')}
                placeholder={t('emailPh')}
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
              />
              <Button onClick={handleSubscribe} isLoading={isSubLoading} className="w-full">
                {t('subscribe')}
              </Button>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h3 className="mb-3 text-sm font-semibold">{t('activeSubscriptions')}</h3>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t('noSubscriptions')}</p>
            ) : (
              <ul className="space-y-2">
                {subscriptions.map((s) => {
                  const reportLabel =
                    SUBSCRIPTION_REPORT_TYPES.find((rt) => rt.value === s.reportType)?.label ||
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
                        {t('unsubscribe')}
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
                  <DatePresetButton
                    onClick={() => applyDatePreset('today', 'template')}
                    label={t('presetToday')}
                  />
                  <DatePresetButton
                    onClick={() => applyDatePreset('week', 'template')}
                    label={t('presetWeek')}
                  />
                  <DatePresetButton
                    onClick={() => applyDatePreset('month', 'template')}
                    label={t('presetMonth')}
                  />
                  <DatePresetButton
                    onClick={() => applyDatePreset('year', 'template')}
                    label={t('presetYear')}
                  />
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
                    {t('downloadXlsx')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate('csv')}
                    isLoading={isGenerating}
                    disabled={!!dateRangeError}
                  >
                    {t('csv')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate('pdf')}
                    isLoading={isGenerating}
                    disabled={!!dateRangeError}
                  >
                    {t('pdf')}
                  </Button>
                </div>

                {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
                {downloadUrl && (
                  <p className="mt-3 text-sm text-green-600">
                    {t('reportGenerated')}{' '}
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {t('download')}
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-[var(--color-text-secondary)]">
                {t('selectTemplate')}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Custom report builder */
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-4 text-lg font-semibold">{t('customBuilder')}</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            {t('customBuilderHint')}
          </p>

          {/* Entity selection */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">{t('entityLabel')}</label>
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
              <label className="text-sm font-medium">
                {t('fieldsLabel', { count: customFields.size })}
              </label>
              <div className="flex items-center gap-3">
                {customFields.size > 0 && (
                  <button
                    onClick={() => setCustomFields(new Set())}
                    className="text-xs text-[var(--color-text-secondary)] hover:underline"
                  >
                    {t('clear')}
                  </button>
                )}
                <button
                  onClick={selectAllFields}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  {t('selectAll')}
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
            <label className="mb-2 block text-sm font-medium">{t('filtersLabel')}</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <DatePresetButton
                onClick={() => applyDatePreset('today', 'custom')}
                label={t('presetToday')}
              />
              <DatePresetButton
                onClick={() => applyDatePreset('week', 'custom')}
                label={t('presetWeek')}
              />
              <DatePresetButton
                onClick={() => applyDatePreset('month', 'custom')}
                label={t('presetMonth')}
              />
              <DatePresetButton
                onClick={() => applyDatePreset('year', 'custom')}
                label={t('presetYear')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label={t('dateFrom')}
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
              />
              <Input
                label={t('dateTo')}
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
              />
              {customEntity === 'orders' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">{t('statusLabel')}</label>
                  <Select
                    options={[
                      { value: '', label: t('statusAll') },
                      { value: 'new_order', label: t('statusNew') },
                      { value: 'processing', label: t('statusProcessing') },
                      { value: 'confirmed', label: t('statusConfirmed') },
                      { value: 'shipped', label: t('statusShipped') },
                      { value: 'completed', label: t('statusCompleted') },
                      { value: 'cancelled', label: t('statusCancelled') },
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
              {t('downloadXlsx')}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCustomGenerate('csv')}
              isLoading={isGenerating}
              disabled={customFields.size === 0 || !!customDateRangeError}
            >
              {t('csv')}
            </Button>
          </div>

          {customFields.size === 0 && (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              {t('selectAtLeastOne')}
            </p>
          )}

          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
          {downloadUrl && (
            <p className="mt-3 text-sm text-green-600">
              {t('reportGenerated')}{' '}
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {t('download')}
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
