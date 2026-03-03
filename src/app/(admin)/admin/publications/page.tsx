'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import { Trash, Check, Close, Eye } from '@/components/icons';

interface Publication {
  id: number;
  title: string;
  content: string;
  channels: string[];
  hashtags: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  creator: { fullName: string };
}

interface EditForm {
  title: string;
  content: string;
  channels: string[];
  hashtags: string;
  scheduledAt: string;
}

type ViewMode = 'list' | 'calendar';

interface PublicationTemplate {
  label: string;
  title: string;
  content: string;
  hashtags: string;
  channels: string[];
}

const PUBLICATION_TEMPLATES: PublicationTemplate[] = [
  {
    label: 'Новий товар',
    title: 'Новинка: [Назва товару]',
    content:
      'Зустрічайте новинку в нашому магазині!\n\n[Назва товару] — [короткий опис товару та його переваги].\n\nЦіна: [ціна] грн\nЗамовляйте прямо зараз!',
    hashtags: '#новинка #cleanshop #новийтовар',
    channels: ['telegram', 'viber', 'site'],
  },
  {
    label: 'Акція',
    title: 'Акція: [Назва акції]',
    content:
      'Знижка [XX]%! Тільки до [дата]!\n\n[Опис акції та товарів, що беруть участь].\n\nНе пропустіть вигідну пропозицію!',
    hashtags: '#акція #знижка #cleanshop',
    channels: ['telegram', 'viber'],
  },
  {
    label: 'Новина',
    title: '[Заголовок новини]',
    content:
      '[Основний текст новини — що сталося, чому це важливо для клієнтів].\n\nДетальніше на нашому сайті.',
    hashtags: '#новини #cleanshop',
    channels: ['telegram', 'site'],
  },
];

function ChannelCheckboxes({ channels, onChange }: { channels: string[]; onChange: (ch: string) => void }) {
  return (
    <div className="mt-1 flex gap-3">
      {['telegram', 'viber', 'site'].map((ch) => (
        <label key={ch} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={channels.includes(ch)}
            onChange={() => onChange(ch)}
            className="accent-[var(--color-primary)]"
          />
          {ch === 'telegram' ? 'Telegram' : ch === 'viber' ? 'Viber' : 'Сайт'}
        </label>
      ))}
    </div>
  );
}

export default function AdminPublicationsPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    channels: ['telegram'] as string[],
    hashtags: '',
    scheduledAt: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', content: '', channels: [], hashtags: '', scheduledAt: '' });
  const [previewPub, setPreviewPub] = useState<Publication | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const applyTemplate = (tpl: PublicationTemplate) => {
    setForm({
      title: tpl.title,
      content: tpl.content,
      channels: [...tpl.channels],
      hashtags: tpl.hashtags,
      scheduledAt: '',
    });
  };

  const loadPublications = async () => {
    const res = await apiClient.get<Publication[]>('/api/v1/admin/publications');
    if (res.success && res.data) setPublications(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      const res = await apiClient.get<Publication[]>('/api/v1/admin/publications');
      if (res.success && res.data) setPublications(res.data);
      setIsLoading(false);
    };
    load();
  }, []);

  const handleCreate = async () => {
    setIsSubmitting(true);
    const data: Record<string, unknown> = { ...form };
    if (!form.scheduledAt) delete data.scheduledAt;
    const res = await apiClient.post('/api/v1/admin/publications', data);
    if (res.success) {
      setShowForm(false);
      setForm({ title: '', content: '', channels: ['telegram'], hashtags: '', scheduledAt: '' });
      loadPublications();
    }
    setIsSubmitting(false);
  };

  const handlePublish = async (id: number) => {
    await apiClient.post(`/api/v1/admin/publications/${id}/publish`);
    loadPublications();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Видалити публікацію?')) return;
    await apiClient.delete(`/api/v1/admin/publications/${id}`);
    loadPublications();
  };

  const startEdit = (p: Publication) => {
    setEditingId(p.id);
    setEditForm({
      title: p.title,
      content: p.content,
      channels: p.channels,
      hashtags: p.hashtags || '',
      scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 16) : '',
    });
  };

  const saveEdit = async (id: number) => {
    const data: Record<string, unknown> = { ...editForm };
    if (!editForm.scheduledAt) {
      data.scheduledAt = null;
    }
    await apiClient.put(`/api/v1/admin/publications/${id}`, data);
    setEditingId(null);
    loadPublications();
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const toggleChannel = (channels: string[], ch: string) =>
    channels.includes(ch) ? channels.filter((c) => c !== ch) : [...channels, ch];

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: 'Чернетка', scheduled: 'Запланована', published: 'Опублікована', error: 'Помилка' };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === 'published') return 'bg-green-100 text-green-700';
    if (s === 'scheduled') return 'bg-blue-100 text-blue-700';
    if (s === 'error') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-500';
  };

  /* ---------- Calendar helpers ---------- */
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIdx = calendarMonth.getMonth();
  const daysInMonth = new Date(calendarYear, calendarMonthIdx + 1, 0).getDate();
  // Monday = 0 … Sunday = 6
  const firstDayOfWeek = (new Date(calendarYear, calendarMonthIdx, 1).getDay() + 6) % 7;

  const calendarMonthLabel = calendarMonth.toLocaleString('uk-UA', { month: 'long', year: 'numeric' });

  const pubsByDay = publications.reduce<Record<string, Publication[]>>((acc, p) => {
    const dateStr = p.publishedAt || p.scheduledAt || p.createdAt;
    if (!dateStr) return acc;
    const d = new Date(dateStr);
    if (d.getFullYear() === calendarYear && d.getMonth() === calendarMonthIdx) {
      const key = String(d.getDate());
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
    }
    return acc;
  }, {});

  const prevMonth = () => setCalendarMonth(new Date(calendarYear, calendarMonthIdx - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarYear, calendarMonthIdx + 1, 1));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Публікації</h2>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm transition-colors ${viewMode === 'list' ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-[var(--color-bg-secondary)]'}`}
            >
              Список
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm transition-colors ${viewMode === 'calendar' ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-[var(--color-bg-secondary)]'}`}
            >
              Календар
            </button>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Скасувати' : 'Нова публікація'}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Шаблон</label>
              <select
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const tpl = PUBLICATION_TEMPLATES.find((t) => t.label === e.target.value);
                  if (tpl) applyTemplate(tpl);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>Обрати шаблон...</option>
                {PUBLICATION_TEMPLATES.map((tpl) => (
                  <option key={tpl.label} value={tpl.label}>{tpl.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Заголовок"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Заголовок публікації"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Текст</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={4}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                placeholder="Текст публікації..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Канали</label>
              <ChannelCheckboxes
                channels={form.channels}
                onChange={(ch) => setForm((f) => ({ ...f, channels: toggleChannel(f.channels, ch) }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Хештеги"
                value={form.hashtags}
                onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
                placeholder="#акція #cleanshop"
              />
              <div>
                <label className="mb-1 block text-sm font-medium">Запланувати</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <Button onClick={handleCreate} isLoading={isSubmitting}>
              {form.scheduledAt ? 'Запланувати' : 'Створити чернетку'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : viewMode === 'list' ? (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">Заголовок</th>
                <th className="px-4 py-3 text-left font-medium">Канали</th>
                <th className="px-4 py-3 text-center font-medium">Статус</th>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="px-4 py-3 text-right font-medium">Дії</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                  {editingId === p.id ? (
                    <td colSpan={5} className="p-4">
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                            placeholder="Заголовок"
                          />
                          <input
                            value={editForm.hashtags}
                            onChange={(e) => setEditForm({ ...editForm, hashtags: e.target.value })}
                            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                            placeholder="Хештеги"
                          />
                        </div>
                        <textarea
                          value={editForm.content}
                          onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                          rows={3}
                        />
                        <div className="flex flex-wrap items-center gap-4">
                          <ChannelCheckboxes
                            channels={editForm.channels}
                            onChange={(ch) => setEditForm({ ...editForm, channels: toggleChannel(editForm.channels, ch) })}
                          />
                          <input
                            type="datetime-local"
                            value={editForm.scheduledAt}
                            onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })}
                            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                          />
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => setEditingId(null)} className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"><Close size={16} /></button>
                            <button onClick={() => saveEdit(p.id)} className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"><Check size={16} /></button>
                          </div>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="font-medium">{p.title}</span>
                        <p className="line-clamp-1 text-xs text-[var(--color-text-secondary)]">{p.content}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {(p.channels as string[]).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatDate(p.publishedAt || p.scheduledAt || p.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setPreviewPub(p)} className="rounded-[var(--radius)] border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]" title="Переглянути">
                            <Eye size={14} />
                          </button>
                          {p.status !== 'published' && (
                            <>
                              <button onClick={() => startEdit(p)} className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]">Редагувати</button>
                              <Button size="sm" onClick={() => handlePublish(p.id)}>
                                Опублікувати
                              </Button>
                              <button onClick={() => handleDelete(p.id)} className="p-1 text-[var(--color-danger)]"><Trash size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {publications.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                    Публікацій немає
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ---------- Calendar View ---------- */
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          {/* Calendar header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <button onClick={prevMonth} className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-sm hover:bg-[var(--color-bg-secondary)]">&larr;</button>
            <span className="text-sm font-semibold capitalize">{calendarMonthLabel}</span>
            <button onClick={nextMonth} className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-sm hover:bg-[var(--color-bg-secondary)]">&rarr;</button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => (
              <div key={d} className="px-1 py-2 text-center text-xs font-medium text-[var(--color-text-secondary)]">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayKey = String(day);
              const dayPubs = pubsByDay[dayKey] || [];
              const isSelected = selectedDay === dayKey;
              const isToday =
                new Date().getFullYear() === calendarYear &&
                new Date().getMonth() === calendarMonthIdx &&
                new Date().getDate() === day;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                  className={`min-h-[80px] cursor-pointer border-b border-r border-[var(--color-border)] p-1 transition-colors hover:bg-[var(--color-bg-secondary)] ${isSelected ? 'bg-[var(--color-primary)]/5 ring-1 ring-inset ring-[var(--color-primary)]' : ''}`}
                >
                  <div className={`mb-0.5 text-xs font-medium ${isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>
                    {day}
                  </div>
                  {dayPubs.slice(0, 3).map((pub) => (
                    <div
                      key={pub.id}
                      className={`mb-0.5 truncate rounded px-1 text-[10px] leading-tight ${statusColor(pub.status)}`}
                      title={pub.title}
                    >
                      {pub.title}
                    </div>
                  ))}
                  {dayPubs.length > 3 && (
                    <div className="px-1 text-[10px] text-[var(--color-text-secondary)]">+{dayPubs.length - 3} ще</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected day detail panel */}
          {selectedDay && (
            <div className="border-t border-[var(--color-border)] p-4">
              <h3 className="mb-2 text-sm font-semibold">
                {Number(selectedDay)} {calendarMonth.toLocaleString('uk-UA', { month: 'long' })} {calendarYear}
              </h3>
              {(pubsByDay[selectedDay] || []).length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Публікацій на цей день немає</p>
              ) : (
                <div className="space-y-2">
                  {(pubsByDay[selectedDay] || []).map((pub) => (
                    <div key={pub.id} className="flex items-start justify-between rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                      <div>
                        <p className="text-sm font-medium">{pub.title}</p>
                        <p className="line-clamp-1 text-xs text-[var(--color-text-secondary)]">{pub.content}</p>
                        <div className="mt-1 flex gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusColor(pub.status)}`}>{statusLabel(pub.status)}</span>
                          <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px]">{pub.channels.join(', ')}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setPreviewPub(pub)} className="rounded-[var(--radius)] border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]" title="Переглянути">
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <Modal isOpen={!!previewPub} onClose={() => setPreviewPub(null)} size="md">
        {previewPub && (
          <div className="p-6">
            <h3 className="mb-2 text-lg font-bold">{previewPub.title}</h3>
            <div className="mb-4 flex gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(previewPub.status)}`}>
                {statusLabel(previewPub.status)}
              </span>
              {previewPub.channels.map((ch) => (
                <span key={ch} className="rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs">
                  {ch}
                </span>
              ))}
            </div>
            <p className="mb-4 whitespace-pre-wrap text-sm">{previewPub.content}</p>
            {previewPub.hashtags && (
              <p className="mb-4 text-sm text-[var(--color-primary)]">{previewPub.hashtags}</p>
            )}
            <div className="text-xs text-[var(--color-text-secondary)]">
              <p>Автор: {previewPub.creator.fullName}</p>
              <p>Створено: {formatDate(previewPub.createdAt)}</p>
              {previewPub.scheduledAt && <p>Заплановано: {formatDate(previewPub.scheduledAt)}</p>}
              {previewPub.publishedAt && <p>Опубліковано: {formatDate(previewPub.publishedAt)}</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
