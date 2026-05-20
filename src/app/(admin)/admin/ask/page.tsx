'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { matchIntent } from '@/services/nl-router';

const EXAMPLE_GROUPS: { title: string; icon: string; items: string[] }[] = [
  {
    title: 'Замовлення',
    icon: '📦',
    items: ['Замовлення сьогодні', 'Замовлення за тиждень', 'Неоплачені замовлення', 'Нові замовлення'],
  },
  {
    title: 'Товари',
    icon: '🛍️',
    items: ['Товари без фото', 'Низькі залишки', 'Товари немає в наявності', 'Топ-10 за продажами'],
  },
  {
    title: 'Клієнти',
    icon: '👥',
    items: ['Клієнти з Києва', 'Гуртові запити', 'Нові клієнти за тиждень'],
  },
];

export default function AskPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [understood, setUnderstood] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const submit = () => {
    if (navigating) return;
    const intent = matchIntent(q);
    if (!intent) {
      setUnderstood('Не зрозумів запит. Спробуйте з прикладів нижче.');
      return;
    }
    setUnderstood(`→ ${intent.label}`);
    setNavigating(true);
    setTimeout(() => router.push(intent.url), 350);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">🤖 Запитайте адмінку</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Опишіть, що шукаєте, природньою мовою. Я перенесу вас на потрібну сторінку
          з готовими фільтрами.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setUnderstood(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Наприклад: «замовлення сьогодні» або «товари без фото»"
          className="w-full rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-base outline-none focus:border-[var(--color-primary)]"
        />
        <button
          onClick={submit}
          disabled={navigating}
          className="mt-3 w-full rounded-lg bg-[var(--color-primary)] py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {navigating ? 'Переходжу…' : 'Зрозумій і перейди →'}
        </button>
        {understood && (
          <p role="alert" aria-live="polite" className="mt-3 text-sm text-[var(--color-primary)]">
            {understood}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Спробуйте один з прикладів:
        </p>
        {EXAMPLE_GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
          >
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <span>{group.icon}</span>
              {group.title}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((ex) => (
                <button
                  key={ex}
                  disabled={navigating}
                  onClick={() => {
                    if (navigating) return;
                    setQ(ex);
                    const intent = matchIntent(ex);
                    if (intent) {
                      setUnderstood(`→ ${intent.label}`);
                      setNavigating(true);
                      setTimeout(() => router.push(intent.url), 200);
                    }
                  }}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)] disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-[10px] text-[var(--color-text-secondary)]">
        💡 Поки що це NL-маршрутизатор за ключовими словами. Інтеграція з LLM (Claude/GPT)
        — у бекалзі.
      </p>
    </div>
  );
}
