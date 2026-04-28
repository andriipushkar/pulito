'use client';

const ENDPOINT = '/api/v1/events';
const SESSION_STORAGE_KEY = 'pulito-session-id';
const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE_SIZE = 50;

export type TrackEventType =
  | 'page_view'
  | 'product_view'
  | 'category_view'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'cart_view'
  | 'checkout_started'
  | 'checkout_step'
  | 'order_completed'
  | 'wishlist_add'
  | 'wishlist_remove';

export interface TrackEventInput {
  eventType: TrackEventType;
  productId?: number;
  orderId?: number;
  metadata?: Record<string, unknown>;
}

interface QueuedEvent extends TrackEventInput {
  sessionId: string;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `fallback-${Date.now()}`;
  }
}

function ensureListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  const flushOnExit = () => flush(true);
  window.addEventListener('pagehide', flushOnExit);
  window.addEventListener('beforeunload', flushOnExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnExit();
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush(false);
  }, FLUSH_INTERVAL_MS);
}

function flush(useBeacon: boolean) {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);

  const body = JSON.stringify(batch);

  if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    } catch {
      // fall through to fetch
    }
  }

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body,
    credentials: 'include',
    keepalive: true,
  }).catch(() => {
    // swallow — analytics must not break UX
  });
}

export function trackEvent(input: TrackEventInput): void {
  if (typeof window === 'undefined') return;
  ensureListeners();

  const sessionId = getSessionId();
  queue.push({ ...input, sessionId });

  if (queue.length >= MAX_QUEUE_SIZE) {
    flush(false);
  } else {
    scheduleFlush();
  }
}

export function flushTracker(): void {
  flush(true);
}

export function _resetTrackerForTests() {
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  listenersAttached = false;
}
