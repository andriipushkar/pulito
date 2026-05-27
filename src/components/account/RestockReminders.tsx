'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import Button from '@/components/ui/Button';
import { apiClient } from '@/lib/api-client';

interface PredictionProduct {
  id: number;
  name: string;
  slug: string;
  imagePath: string | null;
  priceRetail: number | string;
  images: { pathThumbnail: string | null }[];
}

interface Prediction {
  id: number;
  predictedNextDate: string;
  avgIntervalDays: number;
  confidence: number;
  product: PredictionProduct;
}

export default function RestockReminders() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ predictions: Prediction[] }>('/api/v1/me/predictions')
      .then((res) => {
        if (res.data?.predictions) {
          setPredictions(res.data.predictions);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const getProductImage = (product: PredictionProduct): string | null => {
    if (product.images?.[0]?.pathThumbnail) return product.images[0].pathThumbnail;
    return product.imagePath;
  };

  // Self-hide while loading or when there are no predictions —
  // don't show an empty "no data yet" widget on the dashboard.
  if (isLoading || predictions.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Нагадування про поповнення</h2>

      {predictions.length === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {predictions.map((prediction) => {
            const imageSrc = getProductImage(prediction.product);

            return (
              <div
                key={prediction.id}
                className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)]"
              >
                <div className="flex gap-4 p-4">
                  {/* Product image */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--color-bg-secondary)]">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={prediction.product.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--color-text-secondary)]">
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${prediction.product.slug}`}
                      className="line-clamp-2 text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                    >
                      {prediction.product.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Орієнтовно: {formatDate(prediction.predictedNextDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="border-t border-[var(--color-border)]/60 px-4 py-3">
                  <Link href={`/product/${prediction.product.slug}`}>
                    <Button variant="primary" size="sm" className="w-full">
                      Замовити знову
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
