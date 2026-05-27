'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UseOrderListKeyboardProps {
  orderIds: number[];
  /** Index of the currently focused row (-1 = none). Controlled by the hook. */
  focusIndex: number;
  setFocusIndex: (i: number) => void;
  /** Optional callbacks for action shortcuts. */
  onQuickEdit?: (orderId: number) => void;
  onQuickStatus?: (orderId: number) => void;
  /** Base path for "open detail" navigation. Default: /admin/orders. */
  detailPathPrefix?: string;
}

/**
 * Keyboard navigation for the orders list:
 *
 *   j / ↓   — next order in the list
 *   k / ↑   — previous order
 *   o / Enter — open the focused order (full detail page)
 *   e       — open quick edit drawer for focused order
 *   s       — open quick status change for focused order
 *   ?       — toggle a help overlay listing all shortcuts
 *
 * Skips when the user is typing into an input/textarea/select — otherwise
 * pressing "j" in the search box would scroll past rows.
 */
export function useOrderListKeyboard({
  orderIds,
  focusIndex,
  setFocusIndex,
  onQuickEdit,
  onQuickStatus,
  detailPathPrefix = '/admin/orders',
}: UseOrderListKeyboardProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing.
      if (isEditable(e.target)) return;
      // Ignore when modifier keys are pressed — leave OS shortcuts alone.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const focused = focusIndex >= 0 ? orderIds[focusIndex] : undefined;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          if (orderIds.length === 0) return;
          e.preventDefault();
          setFocusIndex(Math.min(orderIds.length - 1, Math.max(0, focusIndex + 1)));
          break;
        case 'k':
        case 'ArrowUp':
          if (orderIds.length === 0) return;
          e.preventDefault();
          setFocusIndex(Math.max(0, focusIndex - 1));
          break;
        case 'Enter':
        case 'o':
          if (focused != null) {
            e.preventDefault();
            router.push(`${detailPathPrefix}/${focused}`);
          }
          break;
        case 'e':
          if (focused != null && onQuickEdit) {
            e.preventDefault();
            onQuickEdit(focused);
          }
          break;
        case 's':
          if (focused != null && onQuickStatus) {
            e.preventDefault();
            onQuickStatus(focused);
          }
          break;
        case '?':
          e.preventDefault();
          setHelpOpen((v) => !v);
          break;
        case 'Escape':
          if (helpOpen) {
            e.preventDefault();
            setHelpOpen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    orderIds,
    focusIndex,
    setFocusIndex,
    router,
    onQuickEdit,
    onQuickStatus,
    helpOpen,
    detailPathPrefix,
  ]);

  return { helpOpen, setHelpOpen };
}
