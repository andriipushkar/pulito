'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface ChannelStat {
  id: number;
  platform: string;
  subscribersCount: number;
  newSubscribers: number;
  unsubscribes: number;
  messagesCount: number;
  recordedAt: string;
}

interface RecentPub {
  id: number;
  title: string;
  channels: string[];
  publishedAt: string;
  igMediaId: string | null;
  tgMessageId: string | null;
}

export default function AdminChannelsPage() {
  const t = useTranslations('admin.channelsPage');
  const [stats, setStats] = useState<ChannelStat[]>([]);
  const [publications, setPublications] = useState<RecentPub[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ stats: ChannelStat[]; recentPublications: RecentPub[] }>('/api/v1/admin/channels')
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data.stats);
          setPublications(res.data.recentPublications);
        } else {
          toast.error(t('loadError'));
        }
      })
      .catch(() => toast.error(t('networkError')))
      .finally(() => setIsLoading(false));
  }, [t]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  // Show all known platforms + any extras returned by the API
  const knownPlatforms = ['telegram', 'instagram', 'facebook', 'tiktok'];
  const platforms = Array.from(new Set([...knownPlatforms, ...stats.map((s) => s.platform)]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Link
          href="/admin/publications"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          {t('toPublications')}
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => {
          const stat = stats.find((s) => s.platform === platform);
          return (
            <div
              key={platform}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <h3 className="mb-2 text-sm font-semibold capitalize">{platform}</h3>
              {stat ? (
                <div className="space-y-1 text-sm">
                  <p>
                    {t('subscribers')} <strong>{stat.subscribersCount}</strong>
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('new')} <span className="text-green-600">+{stat.newSubscribers}</span>
                    {' · '}
                    {t('unsubscribes')}{' '}
                    <span className="text-[var(--color-danger)]">-{stat.unsubscribes}</span>
                  </p>
                  {stat.messagesCount > 0 && (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t('messages')} {stat.messagesCount}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">{t('noData')}</p>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-4 text-lg font-semibold">{t('recentPublications')}</h3>
      <div className="space-y-2">
        {publications.map((pub) => (
          <Link
            key={pub.id}
            href={`/admin/publications?id=${pub.id}`}
            className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-bg-secondary)]"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{pub.title}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {pub.publishedAt ? new Date(pub.publishedAt).toLocaleString('uk-UA') : '—'}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {pub.channels.map((ch) => (
                <span
                  key={ch}
                  className="rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-xs text-[var(--color-primary)]"
                >
                  {ch}
                </span>
              ))}
            </div>
          </Link>
        ))}
        {publications.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-12 text-center text-[var(--color-text-secondary)]">
            <span className="text-3xl" aria-hidden="true">
              📡
            </span>
            <p className="text-sm font-medium">{t('noPublications')}</p>
            <Link
              href="/admin/publications"
              className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              {t('createPublication')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
