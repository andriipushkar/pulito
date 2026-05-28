'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

// SMS bodies are intentionally kept in Ukrainian: they are sent to the shop's
// customers (Ukrainian-speaking), not shown in the admin UI. Only the picker
// labels/buttons/modal chrome below are localised to the admin's panel locale.
const TEMPLATES: { id: string; build: (v: Props['variables']) => string }[] = [
  {
    id: 'ready',
    build: (v) =>
      `Доброго дня${v.name ? `, ${v.name}` : ''}! Ваше замовлення №${v.orderNumber ?? ''} готове. Pulito Trade`,
  },
  {
    id: 'ttn',
    build: (v) =>
      v.trackingNumber
        ? `Доброго дня! Ваше замовлення №${v.orderNumber ?? ''} відправлено. ТТН: ${v.trackingNumber}. Pulito Trade`
        : `Доброго дня! Ваше замовлення №${v.orderNumber ?? ''} відправлено. Pulito Trade`,
  },
  {
    id: 'payment',
    build: (v) =>
      `Доброго дня${v.name ? `, ${v.name}` : ''}! Очікуємо оплату замовлення №${v.orderNumber ?? ''}${v.total ? ` на ${v.total} грн` : ''}. Pulito Trade`,
  },
  {
    id: 'arrived',
    build: (v) =>
      `Доброго дня! Замовлення №${v.orderNumber ?? ''} прибуло у відділення Нової Пошти. Очікуємо на отримання. Pulito Trade`,
  },
  {
    id: 'thanks',
    build: (v) =>
      `Доброго дня${v.name ? `, ${v.name}` : ''}! Дякуємо за покупку в Pulito Trade. Будемо раді бачити вас знову!`,
  },
];

export default function SmsTemplates({ phone, variables }: Props) {
  const t = useTranslations('admin.smsTemplates');
  const templateLabels: Record<string, string> = {
    ready: t('labelReady'),
    ttn: t('labelTtn'),
    payment: t('labelPayment'),
    arrived: t('labelArrived'),
    thanks: t('labelThanks'),
  };
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
      toast.success(t('copied'), { duration: 2500 });
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
        title={t('smsButtonTitle')}
      >
        💬 SMS
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('dialogLabel')}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">{t('modalTitle', { phone })}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{t('hint')}</p>
            <ul className="space-y-2">
              {TEMPLATES.map((tpl) => {
                const text = tpl.build(variables);
                return (
                  <li
                    key={tpl.id}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] p-3"
                  >
                    <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                      {templateLabels[tpl.id] ?? tpl.id}
                    </p>
                    <p className="mb-2 text-sm">{text}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSend(text)}
                        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)]"
                      >
                        {t('sendSms')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(text)}
                        className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)]"
                      >
                        {t('copy')}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <label className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                {t('customLabel')}
              </label>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={2}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                placeholder={t('customPlaceholder')}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!customText.trim()}
                  onClick={() => handleSend(customText.trim())}
                  className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                >
                  {t('sendSms')}
                </button>
                <button
                  type="button"
                  disabled={!customText.trim()}
                  onClick={() => handleCopy(customText.trim())}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                >
                  {t('copy')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
