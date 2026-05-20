'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

const RFM_SEGMENTS = [
  { value: 'champions', label: 'Чемпіони' },
  { value: 'loyal', label: 'Лояльні' },
  { value: 'recent', label: 'Недавні' },
  { value: 'promising', label: 'Перспективні' },
  { value: 'at_risk', label: 'Під загрозою' },
  { value: 'sleeping', label: 'Сплячі' },
  { value: 'lost', label: 'Втрачені' },
  { value: 'new', label: 'Нові' },
];

const FREQUENCIES = [
  { value: 'once', label: 'Одноразово' },
  { value: 'weekly', label: 'Щотижня' },
  { value: 'biweekly', label: 'Раз на 2 тижні' },
  { value: 'monthly', label: 'Щомісяця' },
];

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

  const loadCampaigns = () => {
    apiClient
      .get<CampaignRule[]>('/api/v1/admin/campaigns')
      .then((res) => {
        if (res.success && res.data) setCampaigns(res.data);
        else toast.error(res.error || 'Помилка завантаження кампаній');
      })
      .catch(() => toast.error('Помилка завантаження кампаній'))
      .finally(() => setIsLoading(false));
  };

  const loadTemplates = () => {
    apiClient
      .get<EmailTemplate[]>('/api/v1/admin/email-templates')
      .then((res) => {
        if (res.success && res.data) setTemplates(Array.isArray(res.data) ? res.data : []);
        else toast.error(res.error || 'Помилка завантаження шаблонів');
      })
      .catch(() => toast.error('Помилка завантаження шаблонів'));
  };

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.emailTemplateId) {
      toast.error('Заповніть всі обовʼязкові поля');
      return;
    }

    const res = await apiClient.post('/api/v1/admin/campaigns', {
      name: form.name,
      rfmSegment: form.rfmSegment,
      emailTemplateId: Number(form.emailTemplateId),
      frequency: form.frequency,
    });

    if (res.success) {
      toast.success('Кампанію створено');
      setShowForm(false);
      setForm({ name: '', rfmSegment: 'champions', emailTemplateId: '', frequency: 'once' });
      loadCampaigns();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/campaigns/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? 'Кампанію вимкнено' : 'Кампанію увімкнено');
    else toast.error(res.error || 'Помилка');
    loadCampaigns();
  };

  const handleDelete = (id: number) => setDeleteId(id);

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/campaigns/${id}`);
    if (res.success) toast.success('Кампанію видалено');
    else toast.error('Помилка видалення');
    loadCampaigns();
  };

  const getSegmentLabel = (value: string) => RFM_SEGMENTS.find((s) => s.value === value)?.label || value;
  const getFrequencyLabel = (value: string) => FREQUENCIES.find((f) => f.value === value)?.label || value;

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
        <h2 className="text-xl font-bold">Email-кампанії за сегментами</h2>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Скасувати' : '+ Нова кампанія'}</Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Назва кампанії"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Повернення втрачених клієнтів"
            />
            <div>
              <label className="mb-1 block text-sm font-medium">RFM Сегмент</label>
              <select
                value={form.rfmSegment}
                onChange={(e) => setForm({ ...form, rfmSegment: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {RFM_SEGMENTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email шаблон</label>
              <select
                value={form.emailTemplateId}
                onChange={(e) => setForm({ ...form, emailTemplateId: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="">Оберіть шаблон</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.subject} ({t.templateKey})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Частота</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>Створити кампанію</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-secondary)]">
              <th className="px-3 py-2">Назва</th>
              <th className="px-3 py-2">Сегмент</th>
              <th className="px-3 py-2">Шаблон</th>
              <th className="px-3 py-2">Частота</th>
              <th className="px-3 py-2">Відправлено</th>
              <th className="px-3 py-2">Остання відправка</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {getSegmentLabel(c.rfmSegment)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">{c.emailTemplate.subject}</td>
                <td className="px-3 py-2 text-xs">{getFrequencyLabel(c.frequency)}</td>
                <td className="px-3 py-2 text-xs">{c._count.logs}</td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">{formatDate(c.lastRunAt)}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActive(c.id, c.isActive)}
                    className={`rounded-full px-3 py-1 text-xs ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {c.isActive ? 'Активна' : 'Вимкнена'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <SendNowButton id={c.id} onSent={loadCampaigns} />
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">
                      Видалити
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {campaigns.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">
            Кампаній ще немає. Створіть першу кампанію для автоматичної розсилки за сегментами клієнтів.
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message="Видалити кампанію? Логи відправок також будуть видалені."
      />
    </div>
  );
}

function SendNowButton({ id, onSent }: { id: number; onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirm(true)}
        className="rounded bg-[var(--color-primary)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
        title="Надіслати кампанію негайно усім клієнтам із сегмента"
      >
        {busy ? '…' : 'Надіслати зараз'}
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
            toast.success(`Надіслано: ${res.data.sent}, пропущено: ${res.data.skipped}`);
            onSent();
          } else {
            toast.error(res.error || 'Помилка надсилання');
          }
        }}
        variant="warning"
        title="Надіслати кампанію зараз?"
        message="Розсилка піде одразу всім користувачам із обраного сегмента, незалежно від графіка. Для одноразових кампаній — пропустяться ті, кому вже надсилали."
        confirmText="Надіслати"
      />
    </>
  );
}
