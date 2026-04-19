'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { apiClient } from '@/lib/api-client';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';

interface ChatRoom {
  id: number;
  status: string;
  subject: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  messages: { id: number; content: string; senderType: string; createdAt: string }[];
  _count: { messages: number };
}

interface ChatMessage {
  id: number;
  senderType: 'customer' | 'agent' | 'system';
  senderId: number | null;
  content: string;
  createdAt: string;
  isRead: boolean;
}

const ROOMS_KEY = '/api/v1/chat';

async function fetcher<T>(url: string): Promise<T> {
  const res = await apiClient.get<T>(url);
  if (!res.success) throw new Error(res.error || 'Failed to fetch');
  return res.data as T;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch rooms list
  const { data: roomsData } = useSWR<{ rooms: ChatRoom[]; unreadCount: number }>(
    isOpen && !activeRoomId ? ROOMS_KEY : null,
    fetcher,
    { refreshInterval: 5000 },
  );

  // Fetch active room messages
  const { data: roomData, isLoading: isLoadingMessages } = useSWR<{
    room: {
      id: number;
      status: string;
      subject: string | null;
      assignedAgent: { fullName: string } | null;
    };
    messages: ChatMessage[];
    total: number;
  }>(isOpen && activeRoomId ? `/api/v1/chat/${activeRoomId}` : null, fetcher, {
    refreshInterval: 3000,
  });

  const totalUnread = roomsData?.unreadCount || 0;

  const handleCreateRoom = useCallback(async () => {
    setIsCreating(true);
    try {
      const res = await apiClient.post('/api/v1/chat', {});
      if (res.success && res.data) {
        const newRoom = res.data as ChatRoom;
        setActiveRoomId(newRoom.id);
        mutate(ROOMS_KEY);
      }
    } finally {
      setIsCreating(false);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeRoomId || isSending) return;
      setIsSending(true);
      try {
        await apiClient.post(`/api/v1/chat/${activeRoomId}`, { content });
        // Mark as read
        await apiClient.post(`/api/v1/chat/${activeRoomId}/read`, {});
        // Refetch messages
        mutate(`/api/v1/chat/${activeRoomId}`);
        mutate(ROOMS_KEY);
      } finally {
        setIsSending(false);
      }
    },
    [activeRoomId, isSending],
  );

  const handleBack = () => {
    setActiveRoomId(null);
  };

  const handleOpenRoom = (roomId: number) => {
    setActiveRoomId(roomId);
    // Mark messages as read
    apiClient.post(`/api/v1/chat/${roomId}/read`, {}).then(() => mutate(ROOMS_KEY));
  };

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Чат підтримки"
        data-testid="chat-bubble"
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
          </svg>
        )}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-5 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
          data-testid="chat-panel"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-primary)] px-4 py-3 text-white">
            {activeRoomId && (
              <button onClick={handleBack} className="mr-1 rounded p-0.5 hover:bg-white/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
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
            )}
            <h3 className="flex-1 text-sm font-semibold">
              {activeRoomId ? roomData?.room?.subject || 'Чат' : 'Підтримка'}
            </h3>
            {activeRoomId && roomData?.room?.status && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {roomData.room.status === 'open' && 'Відкритий'}
                {roomData.room.status === 'assigned' && 'В роботі'}
                {roomData.room.status === 'resolved' && 'Вирішено'}
                {roomData.room.status === 'closed' && 'Закрито'}
              </span>
            )}
          </div>

          {/* Body */}
          {activeRoomId ? (
            <>
              <ChatMessageList messages={roomData?.messages || []} isLoading={isLoadingMessages} />
              <ChatInput
                onSend={handleSendMessage}
                disabled={roomData?.room?.status === 'closed' || isSending}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col overflow-y-auto">
              {/* Room list */}
              {roomsData?.rooms && roomsData.rooms.length > 0 ? (
                <div className="flex-1 overflow-y-auto">
                  {roomsData.rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleOpenRoom(room.id)}
                      className="flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {room.subject || `Чат #${room.id}`}
                          </p>
                          {room._count.messages > 0 && (
                            <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {room._count.messages}
                            </span>
                          )}
                        </div>
                        {room.messages[0] && (
                          <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                            {room.messages[0].content}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={room.status} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--color-text-secondary)]"
                  >
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                  </svg>
                  <p className="text-sm text-[var(--color-text-secondary)]">У вас ще немає чатів</p>
                </div>
              )}
              {/* New chat button */}
              <div className="border-t border-[var(--color-border)] p-3">
                <button
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className="w-full rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  data-testid="chat-new-room"
                >
                  {isCreating ? 'Створення...' : 'Новий чат'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    assigned: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
  };

  const labels: Record<string, string> = {
    open: 'Новий',
    assigned: 'В роботі',
    resolved: 'Вирішено',
    closed: 'Закрито',
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || colors.open}`}
    >
      {labels[status] || status}
    </span>
  );
}
