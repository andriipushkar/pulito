'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/account/PageHeader';

type ChannelKey =
  | 'email_orders'
  | 'email_promo'
  | 'email_price_change'
  | 'telegram_orders'
  | 'telegram_promo'
  | 'viber_orders'
  | 'viber_promo'
  | 'push_orders'
  | 'push_promo';

type Prefs = Record<ChannelKey, boolean>;

const DEFAULT_PREFS: Prefs = {
  email_orders: true,
  email_promo: true,
  email_price_change: true,
  telegram_orders: true,
  telegram_promo: false,
  viber_orders: true,
  viber_promo: false,
  push_orders: true,
  push_promo: false,
};

// Each row in the prefs UI: a notification type + which channels can deliver it.
const SECTIONS: {
  title: string;
  description: string;
  rows: { label: string; description: string; keys: ChannelKey[] }[];
}[] = [
  {
    title: 'Замовлення',
    description: 'Зміна статусу, оплата, відправлення, доставка.',
    rows: [
      {
        label: 'Email',
        description: 'Лист на пошту при кожній зміні статусу.',
        keys: ['email_orders'],
      },
      {
        label: 'Telegram',
        description: 'Миттєве повідомлення у Telegram (якщо привʼязаний акаунт).',
        keys: ['telegram_orders'],
      },
      {
        label: 'Viber',
        description: 'Миттєве повідомлення у Viber.',
        keys: ['viber_orders'],
      },
      {
        label: 'Push (браузер/PWA)',
        description: 'Push-сповіщення в браузері або мобільному PWA.',
        keys: ['push_orders'],
      },
    ],
  },
  {
    title: 'Знижки та акції',
    description: 'Промо-кампанії, спецпропозиції, сезонні розпродажі.',
    rows: [
      { label: 'Email', description: 'Розсилка зі знижками і акціями.', keys: ['email_promo'] },
      { label: 'Telegram', description: 'Анонси акцій у Telegram.', keys: ['telegram_promo'] },
      { label: 'Viber', description: 'Анонси акцій у Viber.', keys: ['viber_promo'] },
      { label: 'Push', description: 'Push-анонси акцій.', keys: ['push_promo'] },
    ],
  },
  {
    title: 'Інше',
    description: 'Зміна ціни на товари у вішлісті, повернення товару в наявність.',
    rows: [
      {
        label: 'Email при зміні ціни',
        description: 'Лист коли товар з вашого вішліста подешевшав.',
        keys: ['email_price_change'],
      },
    ],
  },
];

export default function NotificationsPreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    apiClient
      .get<Prefs>('/api/v1/me/notification-preferences')
      .then((res) => {
        if (res.success && res.data) {
          setPrefs({ ...DEFAULT_PREFS, ...res.data });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const toggle = (key: ChannelKey) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.put('/api/v1/me/notification-preferences', prefs);
      if (res.success) {
        toast.success('Налаштування збережено');
        setDirty(false);
      } else {
        toast.error(res.error || 'Не вдалося зберегти');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        }
        title="Налаштування сповіщень"
      />

      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Оберіть, по яких каналах ви хочете отримувати сповіщення. Сповіщення в кабінеті (на цій
        сторінці) ви бачите завжди — налаштування нижче керують{' '}
        <strong>email/Telegram/Viber/Push</strong>. Назад до{' '}
        <Link href="/account/notifications" className="text-[var(--color-primary)] hover:underline">
          списку сповіщень
        </Link>
        .
      </p>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
          >
            <h2 className="text-base font-semibold">{section.title}</h2>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">{section.description}</p>
            <div className="space-y-3">
              {section.rows.map((row) => (
                <label
                  key={row.keys.join('-')}
                  className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)]/60 p-3 hover:bg-[var(--color-bg-secondary)]/40"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                    checked={row.keys.every((k) => prefs[k])}
                    onChange={() => row.keys.forEach(toggle)}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{row.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
                      {row.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <Button onClick={handleSave} isLoading={isSaving} disabled={!dirty}>
          {dirty ? 'Зберегти зміни' : 'Зміни збережено'}
        </Button>
      </div>
    </div>
  );
}
