// Thin wrapper around the Meta Pixel `fbq` global (loaded in app/layout.tsx,
// which previously only fired PageView). Browser ViewContent/AddToCart/Purchase
// events are what Meta uses for ad optimization + retargeting audiences; for
// Purchase we pass the SAME eventID the server CAPI uses (`Purchase-<orderNumber>`)
// so the two sides deduplicate instead of double-counting.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function fbqTrack(
  event: string,
  params?: Record<string, unknown>,
  opts?: { eventID?: string },
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  if (opts?.eventID) {
    window.fbq('track', event, params ?? {}, { eventID: opts.eventID });
  } else {
    window.fbq('track', event, params ?? {});
  }
}

export {};
