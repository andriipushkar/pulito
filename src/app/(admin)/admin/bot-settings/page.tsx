'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface AutoReply {
  id: number;
  triggerText: string | null;
  responseText: string;
  triggerType: string;
  platform: string;
  priority: number;
  isActive: boolean;
}

interface WelcomeMessage {
  id: number;
  platform: string;
  messageText: string;
  isActive: boolean;
  variant: string;
}

export default function AdminBotSettingsPage() {
  const [replies, setReplies] = useState<AutoReply[]>([]);
  const [welcomes, setWelcomes] = useState<WelcomeMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newReply, setNewReply] = useState({ triggerText: '', responseText: '', platform: 'all' });
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Welcome message editor
  const [showWelcomeForm, setShowWelcomeForm] = useState(false);
  const [welcomeForm, setWelcomeForm] = useState({
    platform: 'telegram',
    messageText: '',
    variant: 'A',
  });
  const [editingWelcomeId, setEditingWelcomeId] = useState<number | null>(null);
  const [editingWelcomeText, setEditingWelcomeText] = useState('');
  const [isSavingWelcome, setIsSavingWelcome] = useState(false);
  const [deleteWelcomeId, setDeleteWelcomeId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        apiClient.get<AutoReply[]>('/api/v1/admin/bot-replies'),
        apiClient.get<WelcomeMessage[]>('/api/v1/admin/bot-welcome'),
      ]);
      if (r1.success && r1.data) setReplies(r1.data);
      if (r2.success && r2.data) setWelcomes(r2.data);
    } catch {
      toast.error('Помилка завантаження налаштувань ботів');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [isSavingReply, setIsSavingReply] = useState(false);
  const addReply = async () => {
    if (isSavingReply) return;
    if (!newReply.responseText.trim()) {
      toast.error('Введіть текст відповіді');
      return;
    }
    setIsSavingReply(true);
    try {
      const res = await apiClient.post('/api/v1/admin/bot-replies', newReply);
      if (res.success) {
        toast.success('Авто-відповідь додано');
        setShowReplyForm(false);
        setNewReply({ triggerText: '', responseText: '', platform: 'all' });
        loadData();
      } else {
        toast.error(res.error || 'Помилка додавання');
      }
    } finally {
      setIsSavingReply(false);
    }
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/bot-replies/${id}`);
    if (res.success) {
      toast.success('Авто-відповідь видалено');
      loadData();
    } else {
      toast.error('Помилка видалення');
    }
  };

  const toggleReplyActive = async (reply: AutoReply) => {
    const res = await apiClient.put(`/api/v1/admin/bot-replies/${reply.id}`, {
      isActive: !reply.isActive,
    });
    if (res.success) {
      setReplies((prev) =>
        prev.map((r) => (r.id === reply.id ? { ...r, isActive: !r.isActive } : r)),
      );
      toast.success(reply.isActive ? 'Авто-відповідь вимкнено' : 'Авто-відповідь увімкнено');
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const createWelcome = async () => {
    if (!welcomeForm.messageText.trim()) {
      toast.error('Введіть текст привітання');
      return;
    }
    setIsSavingWelcome(true);
    const res = await apiClient.post('/api/v1/admin/bot-welcome', {
      platform: welcomeForm.platform,
      messageText: welcomeForm.messageText,
      variant: welcomeForm.variant || 'A',
      isActive: true,
    });
    setIsSavingWelcome(false);
    if (res.success) {
      toast.success('Привітання створено');
      setShowWelcomeForm(false);
      setWelcomeForm({ platform: 'telegram', messageText: '', variant: 'A' });
      loadData();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const startEditWelcome = (w: WelcomeMessage) => {
    setEditingWelcomeId(w.id);
    setEditingWelcomeText(w.messageText);
  };

  const saveWelcomeEdit = async () => {
    if (editingWelcomeId === null) return;
    if (!editingWelcomeText.trim()) {
      toast.error('Текст не може бути порожнім');
      return;
    }
    setIsSavingWelcome(true);
    const res = await apiClient.put('/api/v1/admin/bot-welcome', {
      id: editingWelcomeId,
      messageText: editingWelcomeText,
    });
    setIsSavingWelcome(false);
    if (res.success) {
      toast.success('Привітання оновлено');
      setWelcomes((prev) =>
        prev.map((w) => (w.id === editingWelcomeId ? { ...w, messageText: editingWelcomeText } : w)),
      );
      setEditingWelcomeId(null);
      setEditingWelcomeText('');
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const executeDeleteWelcome = async () => {
    if (deleteWelcomeId === null) return;
    const id = deleteWelcomeId;
    setDeleteWelcomeId(null);
    const res = await apiClient.delete(`/api/v1/admin/bot-welcome?id=${id}`);
    if (res.success) {
      toast.success('Привітання видалено');
      loadData();
    } else {
      toast.error(res.error || 'Помилка видалення');
    }
  };

  const toggleWelcomeActive = async (welcome: WelcomeMessage) => {
    const res = await apiClient.put('/api/v1/admin/bot-welcome', {
      id: welcome.id,
      isActive: !welcome.isActive,
    });
    if (res.success) {
      setWelcomes((prev) =>
        prev.map((w) => (w.id === welcome.id ? { ...w, isActive: !w.isActive } : w)),
      );
      toast.success(welcome.isActive ? 'Привітання вимкнено' : 'Привітання увімкнено');
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Налаштування ботів</h2>

      {/* Welcome Messages */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Привітальні повідомлення</h3>
          <Button size="sm" onClick={() => setShowWelcomeForm(!showWelcomeForm)}>
            {showWelcomeForm ? 'Скасувати' : '+ Додати'}
          </Button>
        </div>

        {showWelcomeForm && (
          <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Платформа</label>
                <select
                  value={welcomeForm.platform}
                  onChange={(e) => setWelcomeForm((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                >
                  <option value="telegram">Telegram</option>
                  <option value="viber">Viber</option>
                </select>
              </div>
              <Input
                label="Варіант (A/B-тест)"
                value={welcomeForm.variant}
                onChange={(e) => setWelcomeForm((f) => ({ ...f, variant: e.target.value }))}
                placeholder="A"
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium">Текст привітання</label>
              <textarea
                value={welcomeForm.messageText}
                onChange={(e) => setWelcomeForm((f) => ({ ...f, messageText: e.target.value }))}
                rows={4}
                placeholder="Вітаємо в нашому магазині! Скористайтеся командами…"
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={createWelcome} isLoading={isSavingWelcome}>
                Створити
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {welcomes.map((w) => (
            <div key={w.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="mr-2 rounded bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">{w.platform}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">Варіант {w.variant}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleWelcomeActive(w)}
                    className={`rounded-full px-2 py-0.5 text-xs transition-colors ${w.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title="Натисніть, щоб змінити статус"
                  >
                    {w.isActive ? 'Активний' : 'Вимкнено'}
                  </button>
                  {editingWelcomeId !== w.id && (
                    <>
                      <button
                        onClick={() => startEditWelcome(w)}
                        className="text-xs text-[var(--color-primary)] hover:underline"
                      >
                        Редагувати
                      </button>
                      <button
                        onClick={() => setDeleteWelcomeId(w.id)}
                        className="text-xs text-[var(--color-danger)] hover:underline"
                      >
                        Видалити
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editingWelcomeId === w.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editingWelcomeText}
                    onChange={(e) => setEditingWelcomeText(e.target.value)}
                    rows={4}
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingWelcomeId(null);
                        setEditingWelcomeText('');
                      }}
                    >
                      Скасувати
                    </Button>
                    <Button size="sm" onClick={saveWelcomeEdit} isLoading={isSavingWelcome}>
                      Зберегти
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm">{w.messageText}</p>
              )}
            </div>
          ))}
          {welcomes.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-8 text-center text-[var(--color-text-secondary)]">
              <span className="text-2xl" aria-hidden="true">👋</span>
              <p className="text-sm">Привітальних повідомлень ще немає</p>
              <button
                onClick={() => setShowWelcomeForm(true)}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                + Створити перше
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto Replies */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Авто-відповіді</h3>
          <Button size="sm" onClick={() => setShowReplyForm(!showReplyForm)}>
            {showReplyForm ? 'Скасувати' : '+ Додати'}
          </Button>
        </div>

        {showReplyForm && (
          <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="Ключове слово" value={newReply.triggerText} onChange={(e) => setNewReply({ ...newReply, triggerText: e.target.value })} />
              <Input label="Відповідь *" value={newReply.responseText} onChange={(e) => setNewReply({ ...newReply, responseText: e.target.value })} />
              <div>
                <label className="mb-1 block text-sm font-medium">Платформа</label>
                <select
                  value={newReply.platform}
                  onChange={(e) => setNewReply({ ...newReply, platform: e.target.value })}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                >
                  <option value="all">Всі</option>
                  <option value="telegram">Telegram</option>
                  <option value="viber">Viber</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={addReply} isLoading={isSavingReply}>Зберегти</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {replies.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-secondary)]">
              {r.triggerText ? (
                <code className="rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs">{r.triggerText}</code>
              ) : (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">будь-який текст</span>
              )}
              <span className="flex-1 truncate text-sm" title={r.responseText}>{r.responseText}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{r.platform}</span>
              <button
                onClick={() => toggleReplyActive(r)}
                className={`rounded-full px-2 py-0.5 text-xs transition-colors ${r.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {r.isActive ? 'Активна' : 'Вимкнено'}
              </button>
              <button onClick={() => setDeleteId(r.id)} className="text-xs text-[var(--color-danger)] hover:underline">Видалити</button>
            </div>
          ))}
          {replies.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-8 text-center text-[var(--color-text-secondary)]">
              <span className="text-2xl" aria-hidden="true">🤖</span>
              <p className="text-sm">Авто-відповідей ще немає</p>
              <button
                onClick={() => setShowReplyForm(true)}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                + Додати першу
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message="Видалити цю авто-відповідь?"
      />

      <ConfirmDialog
        isOpen={deleteWelcomeId !== null}
        onClose={() => setDeleteWelcomeId(null)}
        onConfirm={executeDeleteWelcome}
        variant="danger"
        title="Видалення привітання"
        message="Видалити це привітальне повідомлення?"
        confirmText="Так, видалити"
      />
    </div>
  );
}
