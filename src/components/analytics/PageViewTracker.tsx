'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent, type TrackEventType } from '@/lib/event-tracker';

interface Props {
  /** Override the event type (defaults to 'page_view') */
  eventType?: TrackEventType;
  /** Optional product ID for product_view events */
  productId?: number;
  /** Optional metadata merged into the payload */
  metadata?: Record<string, unknown>;
}

/**
 * Drop-in component that fires a single tracking event on mount and
 * whenever the pathname changes.
 */
export default function PageViewTracker({ eventType = 'page_view', productId, metadata }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent({
      eventType,
      productId,
      metadata: { path: pathname, ...metadata },
    });
  }, [pathname, eventType, productId, metadata]);

  return null;
}
