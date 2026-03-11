'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

export function useAdminHotkeys() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: Shortcut[] = [
    { key: 'd', ctrl: true, shift: true, description: 'Dashboard', action: () => router.push('/admin') },
    { key: 'o', ctrl: true, shift: true, description: 'Замовлення', action: () => router.push('/admin/orders') },
    { key: 'p', ctrl: true, shift: true, description: 'Товари', action: () => router.push('/admin/products') },
    { key: 'u', ctrl: true, shift: true, description: 'Користувачі', action: () => router.push('/admin/users') },
    { key: 'a', ctrl: true, shift: true, description: 'Аналітика', action: () => router.push('/admin/analytics') },
    { key: 'c', ctrl: true, shift: true, description: 'Категорії', action: () => router.push('/admin/categories') },
    { key: '/', ctrl: false, shift: false, description: 'Довідка по гарячих клавішах', action: () => setShowHelp((p) => !p) },
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts in input fields
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      return;
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

      if (e.key.toLowerCase() === shortcut.key && ctrlMatch && shiftMatch) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }

    // Escape to close help
    if (e.key === 'Escape' && showHelp) {
      setShowHelp(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, showHelp]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, shortcuts };
}
