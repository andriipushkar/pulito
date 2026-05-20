'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  phone: string;
  variables: {
    name?: string | null;
    orderNumber?: string | null;
    trackingNumber?: string | null;
    total?: number | null;
  };
}

const TEMPLATES: { id: string; label: string; build: (v: Props['variables']) => string }[] = [
  {
    id: 'ready',
    label: 'Замовлення готове',
    build: (v) =>
      `Доброго дня${v.name ? `, ${v.name}` : ''}! Ваше замовлення №${v.orderNumber ?? ''} готове. Pulito Trade`,
  },
  {
    id: 'ttn',
    label: 'ТТН',
    build: (v) =>
      v.trackingNumber
        ? `Доброго дня! Ваше замовлення №${v.orderNumber ?? ''} відправлено. ТТН: ${v.trackingNumber}. Pulito Trade`
        : `Доброго дня! Ваше замовлення №${v.orderNumber ?? ''} відправлено. Pulito Trade`,
  },
  {
    id: 'payment',
    label: 'Очікуємо оплату',
    build: (v) =>
      `Доброго дня${v.name ? `, ${v.name}` : ''}! Очікуємо оплату замовлення №${v.orderNumber ?? ''}${v.total ? ` на ${v.total} грн` : ''}. Pulito Trade`,
  },
  {
    id: 'arrived',
    label: 'Прибуло у відділення',
    build: (v) =>
      `Доброго дня! Замовлення №${v.orderNumber ?? ''} прибуло у відділення Нової Пошти. Очікуємо на отримання. Pulito Trade`,
  },
  {
    id: 'thanks',
    label: 'Дякуємо за покупку',
    build: (v) =>
      `Доброго дня${v.name ? `, ${v.name}` : ''}! Дякуємо за покупку в Pulito Trade. Будемо раді бачити вас знову!`,
  },
];

export default function SmsTemplates({ phone, variables }: Props) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  if (!phone) return null;

  // Normalize phone for sms: URI. Strip spaces but keep +380.
  const smsPhone = phone.replace(/\s+/g, '');

  const handleSend = (text: string) => {
    // Try the native SMS app first; works great on mobile.
    const uri = `sms:${smsPhone}?body=${encodeURIComponent(text)}`;
    window.location.href = uri;
    setOpen(false);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Текст скопійовано — вставте у Viber/Telegram', { duration: 2500 });
    } catch {
      toast.error('Не вдалося скопіювати');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
        title="SMS клієнту"
      >
        💬 SMS
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="SMS-шаблони"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">SMS для {phone}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                aria-label="Закрити"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              «Надіслати» відкриває SMS-додаток (на телефоні). «Скопіювати» — для вставки
              у Viber/Telegram.
            </p>
            <ul className="space-y-2">
              {TEMPLATES.map((tpl) => {
                const text = tpl.build(variables);
                return (
                  <li key={tpl.id} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                    <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                      {tpl.label}
                    </p>
                    <p className="mb-2 text-sm">{text}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSend(text)}
                        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)]"
                      >
                        Надіслати SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(text)}
                        className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
                      >
                        Скопіювати
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                Свій текст
              </label>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={2}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                placeholder="Напишіть текст…"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!customText.trim()}
                  onClick={() => handleSend(customText.trim())}
                  className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                >
                  Надіслати SMS
                </button>
                <button
                  type="button"
                  disabled={!customText.trim()}
                  onClick={() => handleCopy(customText.trim())}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                >
                  Скопіювати
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
