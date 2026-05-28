'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Check, Copy } from '@/components/icons';

interface FeedDef {
  key: string;
  name: string;
  description: string;
  path: string;
  useCase: string;
  docsUrl: string;
}

const FEEDS: FeedDef[] = [
  {
    key: 'hotline',
    name: 'Hotline.ua',
    description: 'Український агрегатор товарів і цін. Прикріплюється у кабінеті продавця Hotline.',
    path: '/api/v1/feeds/hotline.xml',
    useCase: 'Hotline тягне фід раз на 30 хв і оновлює ціни/наявність на агрегаторі.',
    docsUrl: 'https://hotline.ua/dashboard/',
  },
  {
    key: 'google',
    name: 'Google Merchant Center',
    description:
      'Стандарт RSS 2.0 + g:namespace для Google Shopping. Включає g:google_product_category та g:shipping.',
    path: '/feed/google-shopping',
    useCase: 'У Merchant Center → Продукти → Фіди → Запланований отримання → URL.',
    docsUrl: 'https://merchants.google.com/mc/feeds',
  },
  {
    key: 'facebook',
    name: 'Facebook / Meta Catalog',
    description:
      'Той самий формат, що Google Merchant — Meta Commerce Manager сумісний. Використовується для Dynamic Ads у IG/FB.',
    path: '/feed/google-shopping',
    useCase: 'Commerce Manager → Каталог → Джерело даних → Запланований фід.',
    docsUrl: 'https://business.facebook.com/commerce/',
  },
];

export default function AdminFeedsPage() {
  const t = useTranslations('admin.feedsPage');
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function ping(key: string, path: string) {
    setCounts((s) => ({ ...s, [key]: null }));
    try {
      const res = await fetch(path, { cache: 'no-store' });
      const text = await res.text();
      const matches = text.match(/<item/gi) || text.match(/<item>/gi) || [];
      setCounts((s) => ({ ...s, [key]: matches.length }));
      toast.success(t('pingSuccess', { key, count: matches.length }));
    } catch {
      toast.error(t('fetchError'));
      setCounts((s) => ({ ...s, [key]: -1 }));
    }
  }

  async function copy(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(t('copyError'));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {FEEDS.map((f) => {
          const url = origin ? `${origin}${f.path}` : f.path;
          const count = counts[f.key];
          return (
            <article
              key={f.key}
              className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{f.name}</h2>
                <a
                  href={f.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  {t('cabinet')}
                </a>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">{f.description}</p>
              <div className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-xs">
                <code className="flex-1 break-all">{url}</code>
                <button
                  onClick={() => copy(url, f.key)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-[var(--color-bg)]"
                  aria-label={t('copyUrl')}
                >
                  {copied === f.key ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">{f.useCase}</p>
              <div className="mt-auto flex gap-2">
                <button
                  onClick={() => ping(f.key, f.path)}
                  className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-secondary)]"
                >
                  {t('check')}
                </button>
                <a
                  href={f.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-secondary)]"
                >
                  {t('open')}
                </a>
                {typeof count === 'number' && (
                  <span className="self-center text-xs text-[var(--color-text-secondary)]">
                    {count >= 0 ? t('itemsFound', { count }) : t('errorLabel')}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm">
        <h2 className="mb-2 font-semibold">{t('howToConnect')}</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[var(--color-text-secondary)]">
          <li>{t('stepCopy')}</li>
          <li>{t('stepAdd')}</li>
          <li>{t('stepInterval')}</li>
          <li>
            {t('stepAuth')}
            <Link
              href="/admin/integrations"
              className="ml-1 text-[var(--color-primary)] hover:underline"
            >
              {t('integrationsLink')}
            </Link>
            .
          </li>
        </ol>
      </section>
    </div>
  );
}
