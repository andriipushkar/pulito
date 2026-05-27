'use client';

interface ShortcutRow {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['j', '↓'], description: 'Наступне замовлення' },
  { keys: ['k', '↑'], description: 'Попереднє замовлення' },
  { keys: ['Enter', 'o'], description: 'Відкрити замовлення' },
  { keys: ['e'], description: 'Швидке редагування (drawer)' },
  { keys: ['s'], description: 'Швидка зміна статусу' },
  { keys: ['?'], description: 'Показати/сховати цю довідку' },
  { keys: ['Esc'], description: 'Закрити довідку' },
];

/** Modal-style overlay that lists all keyboard shortcuts. Toggled by `?`. */
export default function KeyboardShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
          <h3 className="text-lg font-semibold">Гарячі клавіші</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            aria-label="Закрити"
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
          Підказка: натисніть <kbd className="rounded border px-1">?</kbd> в будь-який момент щоб
          відкрити цей список.
        </p>
      </div>
    </div>
  );
}
