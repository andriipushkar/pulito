'use client';

import { useEffect, useRef } from 'react';
import { gtagEvent } from '@/lib/gtag';

interface Props {
  id: string | number;
  code: string;
  name: string;
  price: number;
  brand?: string | null;
  category?: string | null;
}

/**
 * Fires the GA4 `view_item` event once per product view. Mounted on the
 * product detail page. No-op when gtag isn't loaded.
 */
export default function ViewItemTracker(props: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    gtagEvent.viewItem({
      item_id: props.code || String(props.id),
      item_name: props.name,
      price: props.price,
      item_brand: props.brand ?? undefined,
      item_category: props.category ?? undefined,
    });
  }, [props.id, props.code, props.name, props.price, props.brand, props.category]);

  return null;
}
