'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface AnalyticsAlert {
  id: string;
  metric: string;
  condition: 'above' | 'below';
  threshold: number;
  channel: 'email' | 'telegram';
  isActive: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
];

export default function AlertsConfig() {
  const t = useTranslations('admin.alertsConfig');
  const METRIC_OPTIONS = [
    { value: 'daily_revenue', label: t('metricDailyRevenue') },
    { value: 'daily_orders', label: t('metricDailyOrders') },
    { value: 'avg_check', label: t('metricAvgCheck') },
    { value: 'stock_zero', label: t('metricStockZero') },
    { value: 'new_users', label: t('metricNewUsers') },
    { value: 'cancelled_orders', label: t('metricCancelledOrders') },
  ];
  const CONDITION_OPTIONS = [
    { value: 'above', label: t('conditionAbove') },
    { value: 'below', label: t('conditionBelow') },
  ];
  const [alerts, setAlerts] = useState<AnalyticsAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    metric: 'daily_revenue',
    condition: 'below',
    threshold: '',
    channel: 'telegram',
  });

  const loadAlerts = () => {
    setIsLoading(true);
    apiClient
      .get<AnalyticsAlert[]>('/api/v1/admin/analytics/alerts')
      .then((res) => {
        if (res.success && res.data) setAlerts(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.post('/api/v1/admin/analytics/alerts', {
        metric: form.metric,
        condition: form.condition,
        threshold: Number(form.threshold),
        channel: form.channel,
      });
      if (res.success) {
        setShowForm(false);
        setForm({
          metric: 'daily_revenue',
          condition: 'below',
          threshold: '',
          channel: 'telegram',
        });
        loadAlerts();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (alert: AnalyticsAlert) => {
    await apiClient.put(`/api/v1/admin/analytics/alerts/${alert.id}`, {
      isActive: !alert.isActive,
    });
    loadAlerts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await apiClient.delete(`/api/v1/admin/analytics/alerts/${id}`);
    loadAlerts();
  };

  const getMetricLabel = (key: string) => METRIC_OPTIONS.find((m) => m.value === key)?.label || key;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
          {t('title')}
        </h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : t('add')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium">{t('metricLabel')}</label>
              <Select
                options={METRIC_OPTIONS}
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t('conditionLabel')}</label>
              <Select
                options={CONDITION_OPTIONS}
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              />
            </div>
            <Input
              label={t('thresholdLabel')}
              type="number"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-xs font-medium">{t('channelLabel')}</label>
              <Select
                options={CHANNEL_OPTIONS}
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="mt-3"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!form.threshold}
          >
            {t('create')}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
          {t('loading')}
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(alert)}
                  className={`h-4 w-8 rounded-full transition-colors ${alert.isActive ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}
                >
                  <span
                    className={`block h-3 w-3 transform rounded-full bg-white transition-transform ${alert.isActive ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </button>
                <span className="text-sm">
                  {getMetricLabel(alert.metric)}{' '}
                  <span className="text-[var(--color-text-secondary)]">
                    {alert.condition === 'above' ? '>' : '<'}
                  </span>{' '}
                  <strong>{alert.threshold}</strong>
                </span>
                <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-xs">
                  {alert.channel}
                </span>
              </div>
              <button
                onClick={() => handleDelete(alert.id)}
                className="text-xs text-[var(--color-danger)] hover:underline"
              >
                {t('deleteLink')}
              </button>
            </div>
          ))}
          {alerts.length === 0 && (
            <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
              {t('empty')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
