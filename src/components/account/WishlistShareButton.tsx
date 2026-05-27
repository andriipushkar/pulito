'use client';

import { useState } from 'react';
import { toast } from 'sonner';

/**
 * "Поділитися списком" — encodes wishlist product IDs as base64-url and
 * generates a public link. Uses Web Share API on mobile (native share sheet)
 * with a fallback to clipboard copy on desktop.
 *
 * No DB column is needed — IDs travel in the URL itself. Trade-off: very long
 * lists make ugly URLs (>200 chars at ~25 IDs); cap at 50 server-side anyway.
 */
export default function WishlistShareButton({ productIds }: { productIds: number[] }) {
  const [busy, setBusy] = useState(false);

  if (productIds.length === 0) return null;

  const handleShare = async () => {
    setBusy(true);
    try {
      // base64url (no padding, +/ → -_) keeps the URL clean.
      const encoded = Buffer.from(productIds.join(','))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const url = `${window.location.origin}/wishlist/share/${encoded}`;
      const shareData = {
        title: 'Мій список бажань на Pulito Trade',
        text: `Подивись що я обрала: ${productIds.length} ${productIds.length === 1 ? 'товар' : 'товарів'}.`,
        url,
      };

      // Native share sheet (mobile + some desktop) is the best UX when available.
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        toast.success('Поділилися');
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Посилання скопійовано в буфер');
      }
    } catch (err) {
      // User cancelled share — ignore. Real errors → show.
      if ((err as Error)?.name !== 'AbortError') {
        toast.error('Не вдалося поділитися');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
    >
      📤 Поділитися ({productIds.length})
    </button>
  );
}
