'use client';

import { useEffect, useRef } from 'react';

interface ChatMessageData {
  id: number;
  senderType: 'customer' | 'agent' | 'system';
  senderId?: number | null;
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface ChatMessageListProps {
  messages: ChatMessageData[];
  isLoading?: boolean;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-[var(--color-text-secondary)]">
        Немає повідомлень. Напишіть перше!
      </div>
    );
  }

  // Pre-compute "show date separator" flags per message so the render loop
  // stays pure (no mutation of closure variables across iterations). React
  // Compiler requires this for safe memoization.
  const dateFlags = (() => {
    const flags: boolean[] = [];
    let prev = '';
    for (const msg of messages) {
      const d = formatDate(msg.createdAt);
      flags.push(d !== prev);
      prev = d;
    }
    return flags;
  })();

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
      {messages.map((msg, idx) => {
        const msgDate = formatDate(msg.createdAt);
        const showDateSeparator = dateFlags[idx];

        if (msg.senderType === 'system') {
          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="my-2 text-center text-[11px] text-[var(--color-text-secondary)]">
                  {msgDate}
                </div>
              )}
              <div className="text-center text-xs text-[var(--color-text-secondary)] italic py-1">
                {msg.content}
              </div>
            </div>
          );
        }

        const isCustomer = msg.senderType === 'customer';

        return (
          <div key={msg.id}>
            {showDateSeparator && (
              <div className="my-2 text-center text-[11px] text-[var(--color-text-secondary)]">
                {msgDate}
              </div>
            )}
            <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  isCustomer
                    ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    isCustomer ? 'text-white/70' : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
