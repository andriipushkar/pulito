'use client';

import { useTranslations } from 'next-intl';

interface ShortcutRow {
  keys: string[];
  description: string;
}

/** Modal-style overlay that lists all keyboard shortcuts. Toggled by `?`. */
export default function KeyboardShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('admin.keyboardShortcutsHelp');
  const SHORTCUTS: ShortcutRow[] = [
    { keys: ['j', '↓'], description: t('shortcutNext') },
    { keys: ['k', '↑'], description: t('shortcutPrev') },
    { keys: ['Enter', 'o'], description: t('shortcutOpen') },
    { keys: ['e'], description: t('shortcutQuickEdit') },
    { keys: ['s'], description: t('shortcutQuickStatus') },
    { keys: ['?'], description: t('shortcutToggleHelp') },
    { keys: ['Esc'], description: t('shortcutCloseHelp') },
  ];
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--color-bg)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-text)]">{s.description}</span>
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-[var(--color-text-secondary)]">
          {t.rich('hint', {
            kbd: (chunks) => <kbd className="rounded border px-1">{chunks}</kbd>,
          })}
        </p>
      </div>
    </div>
  );
}
