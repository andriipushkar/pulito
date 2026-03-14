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

  const addReply = async () => {
    if (!newReply.responseText.trim()) {
      toast.error('Введіть текст відповіді');
      return;
    }
    const res = await apiClient.post('/api/v1/admin/bot-replies', newReply);
    if (res.success) {
      toast.success('Авто-відповідь додано');
      setShowReplyForm(false);
      setNewReply({ triggerText: '', responseText: '', platform: 'all' });
      loadData();
    } else {
      toast.error(res.error || 'Помилка додавання');
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

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Налаштування ботів</h2>

      {/* Welcome Messages */}
      <div className="mb-8">
        <h3 className="mb-4 text-lg font-semibold">Привітальні повідомлення</h3>
        <div className="space-y-2">
          {welcomes.map((w) => (
            <div key={w.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="mr-2 rounded bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">{w.platform}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">Варіант {w.variant}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${w.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {w.isActive ? 'Активний' : 'Вимкнено'}
                </span>
              </div>
              <p className="mt-2 text-sm">{w.messageText}</p>
            </div>
          ))}
          {welcomes.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">Немає привітань</p>
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
              <Button size="sm" onClick={addReply}>Зберегти</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {replies.map((r) => (
            <div key={r.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-secondary)]">
              <code className="rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs">{r.triggerText}</code>
              <span className="flex-1 text-sm">{r.responseText}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{r.platform}</span>
              <button onClick={() => setDeleteId(r.id)} className="text-xs text-[var(--color-danger)] hover:underline">Видалити</button>
            </div>
          ))}
          {replies.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">Авто-відповідей немає</p>
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
    </div>
  );
}
