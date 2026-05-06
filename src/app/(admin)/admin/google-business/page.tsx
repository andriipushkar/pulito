'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface GoogleReview {
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number;
  text: string;
  relativeTime: string;
  timestamp: number;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  rating: number | null;
  totalRatings: number | null;
  url: string | null;
  reviewUrl: string | null;
  phoneNumber: string | null;
  website: string | null;
  reviews: GoogleReview[];
}

interface ApiResponse {
  configured: boolean;
  details: PlaceDetails | null;
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="text-amber-500">
      {'★'.repeat(filled)}
      <span className="text-[var(--color-border)]">{'★'.repeat(5 - filled)}</span>
    </span>
  );
}

export default function GoogleBusinessPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = (force = false) => {
    if (force) setRefreshing(true);
    else setIsLoading(true);
    apiClient
      .get<ApiResponse>(`/api/v1/admin/google-business${force ? '?force=1' : ''}`)
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          toast.error(res.error || 'Помилка завантаження');
        }
      })
      .finally(() => {
        setIsLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div>
        <h2 className="mb-4 text-xl font-bold">Google Business Profile</h2>
        <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">Інтеграція не налаштована</p>
          <p className="mt-1 text-amber-800">
            Щоб бачити рейтинг та відгуки з Google Maps, додайте у{' '}
            <a className="underline" href="/admin/settings">
              налаштуваннях сайту
            </a>{' '}
            два значення:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
            <li>
              <code className="rounded bg-amber-100 px-1">google_maps_api_key</code> — Google Cloud
              API key з увімкненим Places API
            </li>
            <li>
              <code className="rounded bg-amber-100 px-1">google_business_place_id</code> — Place ID
              вашого закладу{' '}
              <a
                className="underline"
                href="https://developers.google.com/maps/documentation/javascript/place-id"
                target="_blank"
                rel="noopener noreferrer"
              >
                (як знайти)
              </a>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  const d = data.details;
  if (!d) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Google Business Profile</h2>
        <Button onClick={() => load(true)} disabled={refreshing} variant="outline" size="sm">
          {refreshing ? 'Оновлюємо…' : 'Оновити з Google'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs uppercase text-[var(--color-text-secondary)]">Заклад</p>
          <p className="text-lg font-semibold">{d.name}</p>
          {d.formattedAddress ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{d.formattedAddress}</p>
          ) : null}
          {d.phoneNumber ? <p className="mt-2 text-sm">{d.phoneNumber}</p> : null}
          {d.website ? (
            <a
              href={d.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-[var(--color-primary)] underline"
            >
              {d.website}
            </a>
          ) : null}
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs uppercase text-[var(--color-text-secondary)]">Рейтинг</p>
          {d.rating !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{d.rating.toFixed(1)}</span>
              <Stars rating={d.rating} />
              <span className="text-sm text-[var(--color-text-secondary)]">
                ({d.totalRatings ?? 0} відгуків)
              </span>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">Ще немає відгуків</p>
          )}
          <div className="mt-3 flex gap-2">
            {d.url ? (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs"
              >
                Відкрити в Maps
              </a>
            ) : null}
            {d.reviewUrl ? (
              <a
                href={d.reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white"
              >
                Залишити відгук →
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Останні відгуки</h3>
        {d.reviews.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Відгуків ще немає.</p>
        ) : (
          <div className="space-y-3">
            {d.reviews.map((r) => (
              <div
                key={r.timestamp}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {}
                    {r.authorPhotoUrl ? (
                      <img
                        src={r.authorPhotoUrl}
                        alt={r.authorName}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : null}
                    <span className="font-medium">{r.authorName}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {r.relativeTime}
                  </span>
                </div>
                {r.text ? <p className="mt-2 text-sm whitespace-pre-wrap">{r.text}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius)] border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        ℹ️ Дані кешуються на годину для економії квоти Google API. Натисніть «Оновити з Google» для
        примусового оновлення.
      </div>
    </div>
  );
}
