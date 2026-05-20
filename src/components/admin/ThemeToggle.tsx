'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'admin-theme-mode';

function applyTheme(mode: ThemeMode) {
  const html = document.documentElement;
  if (mode === 'system') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', mode);
  }
}

// In-memory bus so writes from one ThemeToggle instance notify others in the same tab.
const themeListeners = new Set<() => void>();
const subscribeTheme = (cb: () => void) => {
  themeListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    themeListeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
};
const notifyTheme = () => {
  for (const cb of themeListeners) cb();
};
const getThemeSnapshot = (): ThemeMode =>
  (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) || 'system';
const getThemeServerSnapshot = (): ThemeMode => 'system';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const mode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  // Apply theme post-mount (DOM side-effect, not React state).
  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const handleChange = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    notifyTheme();
  }, []);

  if (compact) {
    // Single-button cycle for collapsed sidebar
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    const icon = mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : '🖥️';
    const label = mode === 'light' ? 'Світла' : mode === 'dark' ? 'Темна' : 'Системна';
    return (
      <button
        type="button"
        onClick={() => handleChange(next)}
        title={`Тема: ${label} (натисніть для зміни)`}
        aria-label={`Тема: ${label}`}
        className="rounded-[var(--radius)] p-1.5 text-base hover:bg-[var(--color-bg-secondary)]"
      >
        {icon}
      </button>
    );
  }

  const options: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Світла', icon: '☀️' },
    { value: 'dark', label: 'Темна', icon: '🌙' },
    { value: 'system', label: 'Системна', icon: '🖥️' },
  ];

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5"
      role="radiogroup"
      aria-label="Тема оформлення"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={mode === opt.value}
          onClick={() => handleChange(opt.value)}
          title={opt.label}
          className={`rounded-[var(--radius)] px-2 py-1 text-xs transition-colors ${
            mode === opt.value
              ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          <span aria-hidden="true">{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
