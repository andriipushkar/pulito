'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ open, onClose }: Props) {
  const t = useTranslations('admin.shortcutsModal');
  const GROUPS: { title: string; shortcuts: Shortcut[] }[] = [
    {
      title: t('groupNav'),
      shortcuts: [
        { keys: ['Ctrl', 'K'], description: t('openSearch') },
        { keys: ['/'], description: t('focusMenuSearch') },
        { keys: ['?'], description: t('showHelp') },
        { keys: ['Esc'], description: t('closeModal') },
      ],
    },
    {
      title: t('groupGoto'),
      shortcuts: [
        { keys: ['g', 'd'], description: 'Dashboard' },
        { keys: ['g', 'o'], description: t('gotoOrders') },
        { keys: ['g', 'p'], description: t('gotoProducts') },
        { keys: ['g', 'u'], description: t('gotoUsers') },
        { keys: ['g', 'c'], description: t('gotoCategories') },
        { keys: ['g', 'a'], description: t('gotoAnalytics') },
        { keys: ['g', 's'], description: t('gotoSettings') },
      ],
    },
    {
      title: t('groupActions'),
      shortcuts: [{ keys: ['n'], description: t('createNew') }],
    },
  ];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--color-text)]">{t('title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {GROUPS.map((g) => (
            <section key={g.title} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.shortcuts.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--color-text)]">{s.description}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {t('then')}
                            </span>
                          )}
                          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text)]">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-5 py-2.5 text-[11px] text-[var(--color-text-secondary)]">
          {t.rich('hint', {
            kbd: (chunks) => (
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 font-mono">
                {chunks}
              </kbd>
            ),
          })}
        </div>
      </div>
    </div>
  );
}
