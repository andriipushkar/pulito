'use client';

import { useEffect, useState } from 'react';

interface SocialProofProps {
  productId: number;
  ordersCount: number;
  viewsCount: number;
}

export default function SocialProof({ productId, ordersCount, viewsCount }: SocialProofProps) {
  const [viewersNow, setViewersNow] = useState(0);

  useEffect(() => {
    // Simulate "viewing now" based on product popularity
    const base = Math.min(Math.floor(viewsCount / 100), 8);
    const jitter = Math.floor(Math.random() * 3);
    setViewersNow(Math.max(1, base + jitter));

    // Periodically update
    const interval = setInterval(() => {
      const newJitter = Math.floor(Math.random() * 3) - 1;
      setViewersNow((prev) => Math.max(1, prev + newJitter));
    }, 15000);

    return () => clearInterval(interval);
  }, [viewsCount]);

  const weeklyOrders = Math.min(ordersCount, Math.floor(ordersCount / 4) + Math.floor(Math.random() * 3));

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {viewersNow > 1 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          {viewersNow} {viewersNow < 5 ? 'людини' : 'людей'} дивляться зараз
        </span>
      )}

      {weeklyOrders > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-green-600">
          Куплено {weeklyOrders} {weeklyOrders === 1 ? 'раз' : weeklyOrders < 5 ? 'рази' : 'разів'} за тиждень
        </span>
      )}

      {ordersCount >= 50 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-600">
          Хіт продажів
        </span>
      )}
    </div>
  );
}
