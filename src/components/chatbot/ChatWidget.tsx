'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { apiClient } from '@/lib/api-client';

interface Source {
  type: 'faq' | 'product' | 'page' | 'ai';
  title: string;
  snippet?: string;
  url?: string;
}

interface Reply {
  answer: string;
  sources: Source[];
  escalate: boolean;
}

interface Message {
  role: 'user' | 'bot';
  text: string;
  sources?: Source[];
}

const SUGGESTED: string[] = [
  'Як працює доставка?',
  'Чи можна повернути товар?',
  'Які способи оплати?',
];

/**
 * Floating FAQ chatbot — pinned bottom-right on storefront pages.
 * Queries /api/v1/chatbot/query which combines FAQ search + product lookup +
 * Gemini fallback. Stateless on the server side; conversation kept only in
 * this component's state so closing the panel resets.
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text: 'Привіт! 👋 Я допоможу зорієнтуватися: доставка, оплата, повернення, наявність товарів. Запитуйте.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setInput('');
    setBusy(true);
    try {
      const res = await apiClient.post<Reply>('/api/v1/chatbot/query', { message });
      if (res.success && res.data) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: res.data!.answer, sources: res.data!.sources },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: 'На жаль, не вдалося отримати відповідь. Спробуйте через хвилину.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Збій з’єднання. Перевірте інтернет і спробуйте ще раз.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Закрити чат' : 'Відкрити чат-помічник'}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex w-[min(380px,calc(100vw-2.5rem))] flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-[var(--color-primary)] px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">Помічник Pulito</div>
              <div className="text-[11px] opacity-90">
                {busy ? 'Шукаю відповідь…' : 'Зазвичай відповідаю за пару секунд'}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-white/15"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[55vh] flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-[var(--color-primary)] text-white'
                      : 'rounded-bl-sm bg-[var(--color-bg-secondary)] text-[var(--color-text)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2 text-[12px]">
                      {m.sources.slice(0, 3).map((s, si) => (
                        <li key={si}>
                          {s.url ? (
                            <Link
                              href={s.url}
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              {sourceIcon(s.type)} {s.title}
                            </Link>
                          ) : (
                            <span>
                              {sourceIcon(s.type)} {s.title}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1 text-xs hover:border-[var(--color-primary)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-[var(--color-border)] px-3 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишіть запитання…"
              disabled={busy}
              maxLength={500}
              className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length < 2}
              className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              →
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function sourceIcon(t: Source['type']) {
  if (t === 'faq') return '📘';
  if (t === 'product') return '🛒';
  if (t === 'page') return '📄';
  return '🤖';
}
