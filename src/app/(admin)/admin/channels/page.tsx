'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
  viberMsgToken: string | null;
}

export default function AdminChannelsPage() {
  const [stats, setStats] = useState<ChannelStat[]>([]);
  const [publications, setPublications] = useState<RecentPub[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ stats: ChannelStat[]; recentPublications: RecentPub[] }>('/api/v1/admin/channels')
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data.stats);
          setPublications(res.data.recentPublications);
        } else {
          toast.error('Не вдалося завантажити статистику каналів');
        }
      })
      .catch(() => toast.error('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  const platforms = ['telegram', 'viber', 'instagram'];

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Статистика каналів</h2>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {platforms.map((platform) => {
          const stat = stats.find((s) => s.platform === platform);
          return (
            <div key={platform} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <h3 className="mb-2 text-sm font-semibold capitalize">{platform}</h3>
              {stat ? (
                <div className="space-y-1 text-sm">
                  <p>Підписники: <strong>{stat.subscribersCount}</strong></p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Нових: +{stat.newSubscribers} | Відписки: -{stat.unsubscribes}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">Немає даних</p>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-4 text-lg font-semibold">Останні публікації</h3>
      <div className="space-y-2">
        {publications.map((pub) => (
          <div key={pub.id} className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{pub.title}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {pub.publishedAt ? new Date(pub.publishedAt).toLocaleString('uk-UA') : '—'}
              </p>
            </div>
            <div className="flex gap-1">
              {(pub.channels as string[]).map((ch) => (
                <span key={ch} className="rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-xs text-[var(--color-primary)]">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        ))}
        {publications.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">Публікацій немає</div>
        )}
      </div>
    </div>
  );
}
