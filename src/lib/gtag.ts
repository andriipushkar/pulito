'use client';

/**
 * Type-safe wrapper around window.gtag for GA4 ecommerce events.
 * No-op when gtag is not loaded (i.e. NEXT_PUBLIC_GA4_ID not set).
 *
 * GA4 event reference:
 * https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 */

interface GtagItem {
  item_id: string | number;
  item_name: string;
  price?: number;
  quantity?: number;
  item_brand?: string;
  item_category?: string;
}

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

function send(eventName: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', eventName, { ...params, currency: 'UAH' });
  } catch {
    // never crash UI for analytics
  }
}

export const gtagEvent = {
  viewItem(item: GtagItem & { price: number }) {
    send('view_item', { value: item.price, items: [item] });
  },
  addToCart(item: GtagItem & { price: number; quantity: number }) {
    send('add_to_cart', { value: item.price * item.quantity, items: [item] });
  },
  removeFromCart(item: GtagItem & { price: number; quantity: number }) {
    send('remove_from_cart', { value: item.price * item.quantity, items: [item] });
  },
  beginCheckout(items: GtagItem[], totalValue: number) {
    send('begin_checkout', { value: totalValue, items });
  },
  purchase(params: {
    transaction_id: string;
    value: number;
    tax?: number;
    shipping?: number;
    items: GtagItem[];
    coupon?: string;
  }) {
    send('purchase', params);
  },
  search(query: string) {
    send('search', { search_term: query });
  },
  selectItem(item: GtagItem, listName?: string) {
    send('select_item', { item_list_name: listName, items: [item] });
  },
};
