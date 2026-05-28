'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput from '@/components/chat/ChatInput';
import Button from '@/components/ui/Button';

interface ChatMessage {
  id: number;
  senderType: 'customer' | 'agent' | 'system';
  senderId: number | null;
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface RoomDetail {
  id: number;
  status: string;
  subject: string | null;
  user: { id: number; fullName: string; email: string; avatarUrl: string | null };
  assignedAgent: { id: number; fullName: string; email: string } | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  assigned: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

export default function AdminChatRoomPage() {
  const t = useTranslations('admin.chatRoom');
  const STATUS_LABELS: Record<string, string> = {
    open: t('statusOpen'),
    assigned: t('statusAssigned'),
    resolved: t('statusResolved'),
    closed: t('statusClosed'),
  };
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadRoom = useCallback(() => {
    apiClient
      .get(`/api/v1/admin/chat/${roomId}`)
      .then((res) => {
        if (res.success && res.data) {
          const data = res.data as { room: RoomDetail; messages: ChatMessage[] };
          setRoom(data.room);
          setMessages(data.messages);
        }
      })
      .catch(() => toast.error(t('loadError')))
      .finally(() => setIsLoading(false));
  }, [roomId, t]);

  useEffect(() => {
    loadRoom();
    const interval = setInterval(loadRoom, 3000);
    return () => clearInterval(interval);
  }, [loadRoom]);

  const handleSend = useCallback(
    async (content: string) => {
      if (isSending) return;
      setIsSending(true);
      try {
        const res = await apiClient.post(`/api/v1/admin/chat/${roomId}`, { content });
        if (res.success) {
          loadRoom();
        } else {
          toast.error(res.error || t('errorGeneric'));
        }
      } finally {
        setIsSending(false);
      }
    },
    [roomId, isSending, loadRoom, t],
  );

  const handleAction = async (action: 'assign' | 'resolve' | 'close') => {
    setIsUpdating(true);
    try {
      const res = await apiClient.patch(`/api/v1/admin/chat/${roomId}`, { action });
      if (res.success) {
        const labels: Record<string, string> = {
          assign: t('assignedToast'),
          resolve: t('resolvedToast'),
          close: t('closedToast'),
        };
        toast.success(labels[action]);
        loadRoom();
      } else {
        toast.error(res.error || t('errorGeneric'));
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">{t('notFound')}</div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/chat')}
            className="rounded p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-bold">
              {t('chatNumber', { id: room.id })}
              {room.subject && (
                <span className="ml-2 font-normal text-[var(--color-text-secondary)]">
                  - {room.subject}
                </span>
              )}
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {room.user.fullName} ({room.user.email})
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[room.status] || ''}`}
          >
            {STATUS_LABELS[room.status] || room.status}
          </span>
        </div>
        <div className="flex gap-2">
          {room.status === 'open' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('assign')}
              disabled={isUpdating}
            >
              {t('assign')}
            </Button>
          )}
          {(room.status === 'open' || room.status === 'assigned') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('resolve')}
              disabled={isUpdating}
            >
              {t('resolve')}
            </Button>
          )}
          {room.status !== 'closed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('close')}
              disabled={isUpdating}
            >
              {t('close')}
            </Button>
          )}
        </div>
      </div>

      {/* Agent info */}
      {room.assignedAgent && (
        <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
          {t('agentLabel')} {room.assignedAgent.fullName}
        </p>
      )}

      {/* Messages */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <ChatMessageList messages={messages} />
        <ChatInput
          onSend={handleSend}
          disabled={room.status === 'closed' || isSending}
          placeholder={room.status === 'closed' ? t('inputClosed') : t('inputPlaceholder')}
        />
      </div>
    </div>
  );
}
