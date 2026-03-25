'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getAccessToken } from '@/lib/api-client';

interface ChatMessage {
  id: number;
  roomId: number;
  senderType: 'customer' | 'agent' | 'system';
  senderId: number | null;
  content: string;
  attachmentUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface UseChatStreamOptions {
  roomId: number | null;
  onMessage?: (message: ChatMessage) => void;
}

export function useChatStream({ roomId, onMessage }: UseChatStreamOptions) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const token = getAccessToken();
    if (!token) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(`/api/v1/chat/${roomId}/stream?token=${encodeURIComponent(token)}`);

      es.addEventListener('connected', () => setConnected(true));

      es.addEventListener('message', (e) => {
        const msg: ChatMessage = JSON.parse(e.data);
        setMessages((prev) => {
          // Deduplicate by id
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        onMessageRef.current?.(msg);
      });

      es.addEventListener('error', () => {
        setConnected(false);
        es?.close();
        retryTimeout = setTimeout(connect, 5000);
      });
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimeout);
      setConnected(false);
      setMessages([]);
    };
  }, [roomId]);

  return { connected, messages, clearMessages };
}
