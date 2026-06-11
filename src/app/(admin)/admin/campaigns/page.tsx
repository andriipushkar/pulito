'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface EmailTemplate {
  id: number;
  templateKey: string;
  subject: string;
  isActive: boolean;
}

interface CampaignRule {
  id: number;
  name: string;
  rfmSegment: string;
  emailTemplateId: number;
  emailTemplate: EmailTemplate;
  frequency: string;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  _count: { logs: number };
}

export default function AdminCampaignsPage() {
  const t = useTranslations('admin.adminCampaignsPage');
  const RFM_SEGMENTS = [
    { value: 'champions', label: t('segChampions') },
    { value: 'loyal', label: t('segLoyal') },
    { value: 'recent', label: t('segRecent') },
    { value: 'promising', label: t('segPromising') },
    { value: 'at_risk', label: t('segAtRisk') },
    { value: 'sleeping', label: t('segSleeping') },
    { value: 'lost', label: t('segLost') },
    { value: 'new', label: t('segNew') },
  ];
  const FREQUENCIES = [
    { value: 'once', label: t('freqOnce') },
    { value: 'weekly', label: t('freqWeekly') },
    { value: 'biweekly', label: t('freqBiweekly') },
    { value: 'monthly', label: t('freqMonthly') },
  ];
  const [campaigns, setCampaigns] = useState<CampaignRule[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    rfmSegment: 'champions',
    emailTemplateId: '',
    frequency: 'once',
  });

  const loadCampaigns = useCallback(() => {
    apiClient
      .get<CampaignRule[]>('/api/v1/admin/campaigns')
      .then((res) => {
        if (res.success && res.data) setCampaigns(res.data);
        else toast.error(res.error || t('loadCampaignsError'));
      })
      .catch(() => toast.error(t('loadCampaignsError')))
      .finally(() => setIsLoading(false));
  }, [t]);

  const loadTemplates = useCallback(() => {
    apiClient
      .get<EmailTemplate[]>('/api/v1/admin/email-templates')
      .then((res) => {
        if (res.success && res.data) setTemplates(Array.isArray(res.data) ? res.data : []);
        else toast.error(res.error || t('loadTemplatesError'));
      })
      .catch(() => toast.error(t('loadTemplatesError')));
  }, [t]);

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
  }, [loadCampaigns, loadTemplates]);

  const handleCreate = async () => {
    if (!form.name || !form.emailTemplateId) {
      toast.error(t('validateError'));
      return;
    }

    const res = await apiClient.post('/api/v1/admin/campaigns', {
      name: form.name,
      rfmSegment: form.rfmSegment,
      emailTemplateId: Number(form.emailTemplateId),
      frequency: form.frequency,
    });

    if (res.success) {
      toast.success(t('createdToast'));
      setShowForm(false);
      setForm({ name: '', rfmSegment: 'champions', emailTemplateId: '', frequency: 'once' });
      loadCampaigns();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/campaigns/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? t('disabledToast') : t('enabledToast'));
    else toast.error(res.error || t('errorGeneric'));
    loadCampaigns();
  };

  const handleDelete = (id: number) => setDeleteId(id);

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/campaigns/${id}`);
    if (res.success) toast.success(t('deletedToast'));
    else toast.error(t('deleteError'));
    loadCampaigns();
  };

  const getSegmentLabel = (value: string) =>
    RFM_SEGMENTS.find((s) => s.value === value)?.label || value;
  const getFrequencyLabel = (value: string) =>
    FREQUENCIES.find((f) => f.value === value)?.label || value;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={6} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : t('newBtn')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t('nameLabel')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePh')}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">{t('segmentLabel')}</label>
              <select
                value={form.rfmSegment}
                onChange={(e) => setForm({ ...form, rfmSegment: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {RFM_SEGMENTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('templateLabel')}</label>
              <select
                value={form.emailTemplateId}
                onChange={(e) => setForm({ ...form, emailTemplateId: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="">{t('selectTemplate')}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.subject} ({tpl.templateKey})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('frequencyLabel')}</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>{t('createBtn')}</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-secondary)]">
              <th className="px-3 py-2">{t('colName')}</th>
              <th className="px-3 py-2">{t('colSegment')}</th>
              <th className="px-3 py-2">{t('colTemplate')}</th>
              <th className="px-3 py-2">{t('colFrequency')}</th>
              <th className="px-3 py-2">{t('colSent')}</th>
              <th className="px-3 py-2">{t('colLastSent')}</th>
              <th className="px-3 py-2">{t('colStatus')}</th>
              <th className="px-3 py-2">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {getSegmentLabel(c.rfmSegment)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                  {c.emailTemplate.subject}
                </td>
                <td className="px-3 py-2 text-xs">{getFrequencyLabel(c.frequency)}</td>
                <td className="px-3 py-2 text-xs">{c._count.logs}</td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                  {formatDate(c.lastRunAt)}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActive(c.id, c.isActive)}
                    className={`rounded-full px-3 py-1 text-xs ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {c.isActive ? t('statusActive') : t('statusInactive')}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <SendNowButton id={c.id} onSent={loadCampaigns} />
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {campaigns.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">{t('empty')}</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message={t('deleteConfirm')}
      />
    </div>
  );
}

function SendNowButton({ id, onSent }: { id: number; onSent: () => void }) {
  const t = useTranslations('admin.adminCampaignsPage');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirm(true)}
        className="rounded bg-[var(--color-primary)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
        title={t('sendNowTitle')}
      >
        {busy ? t('sending') : t('sendNow')}
      </button>
      <ConfirmDialog
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          setBusy(true);
          const res = await apiClient.post<{ sent: number; skipped: number }>(
            `/api/v1/admin/campaigns/${id}/send-now`,
          );
          setBusy(false);
          if (res.success && res.data) {
            toast.success(t('sentToast', { sent: res.data.sent, skipped: res.data.skipped }));
            onSent();
          } else {
            toast.error(res.error || t('sendError'));
          }
        }}
        variant="warning"
        title={t('sendConfirmTitle')}
        message={t('sendConfirmMsg')}
        confirmText={t('sendConfirmBtn')}
      />
    </>
  );
}
