'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

interface SavedView {
  id: string;
  name: string;
  query: string;
}

interface Props {
  /**
   * Unique storage key per page (e.g. "orders", "products"). Views are
   * persisted to localStorage under `admin-saved-views:{storageKey}`.
   */
  storageKey: string;
  /**
   * Base path of the listing page so saved views can be applied via
   * router.push(`${basePath}?${view.query}`).
   */
  basePath: string;
}

// In-memory bus so updates from the same tab are observed without waiting for
// a `storage` event (which only fires cross-tab).
const viewsListeners = new Map<string, Set<() => void>>();
const notifyViews = (key: string) => {
  viewsCache.delete(key);
  for (const cb of viewsListeners.get(key) ?? []) cb();
};
const EMPTY_VIEWS: SavedView[] = [];
// Snapshot cache — useSyncExternalStore requires reference-stable returns
// while the underlying data is unchanged.
const viewsCache = new Map<string, SavedView[]>();

export default function SavedViews({ storageKey, basePath }: Props) {
  const t = useTranslations('admin.savedViews');
  const router = useRouter();
  const searchParams = useSearchParams();
  const fullKey = `admin-saved-views:${storageKey}`;

  const subscribe = useCallback(
    (cb: () => void) => {
      const set = viewsListeners.get(fullKey) ?? new Set<() => void>();
      set.add(cb);
      viewsListeners.set(fullKey, set);
      const onStorage = (e: StorageEvent) => {
        if (e.key === fullKey) cb();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        set.delete(cb);
        // Drop the per-key entry when the last subscriber leaves so
        // viewsListeners doesn't grow unbounded across mount/unmount cycles.
        if (set.size === 0) viewsListeners.delete(fullKey);
        window.removeEventListener('storage', onStorage);
      };
    },
    [fullKey],
  );
  const getSnapshot = useCallback((): SavedView[] => {
    const cached = viewsCache.get(fullKey);
    if (cached) return cached;
    try {
      const raw = localStorage.getItem(fullKey);
      const parsed = raw ? (JSON.parse(raw) as SavedView[]) : EMPTY_VIEWS;
      viewsCache.set(fullKey, parsed);
      return parsed;
    } catch {
      viewsCache.set(fullKey, EMPTY_VIEWS);
      return EMPTY_VIEWS;
    }
  }, [fullKey]);
  const getServerSnapshot = useCallback(() => EMPTY_VIEWS, []);
  const views = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState('');

  const persist = (next: SavedView[]) => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(next));
    } catch {
      // Quota exceeded — ignore, in-memory state still works for the session.
    }
    notifyViews(fullKey);
  };

  const currentQuery = searchParams?.toString() ?? '';
  const hasFilters = currentQuery.length > 0;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existingIdx = views.findIndex((v) => v.name === trimmed);
    let next: SavedView[];
    if (existingIdx >= 0) {
      // Preserve position when overwriting — replacing in-place avoids the
      // jarring "the view I just updated jumped to the end of the list".
      next = views.slice();
      next[existingIdx] = { ...next[existingIdx], query: currentQuery };
    } else {
      next = [...views, { id: `${Date.now()}`, name: trimmed, query: currentQuery }];
    }
    persist(next);
    setName('');
    setShowSave(false);
    toast.success(t('saved', { name: trimmed }));
  };

  const handleApply = (view: SavedView) => {
    router.push(view.query ? `${basePath}?${view.query}` : basePath);
  };

  const handleDelete = (id: string) => {
    persist(views.filter((v) => v.id !== id));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.length > 0 && (
        <span className="text-xs text-[var(--color-text-secondary)]">{t('savedLabel')}</span>
      )}
      {views.map((v) => (
        <span
          key={v.id}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs"
        >
          <button
            type="button"
            onClick={() => handleApply(v)}
            className="font-medium hover:text-[var(--color-primary)]"
            title={t('applyTitle', { query: v.query || t('empty') })}
          >
            {v.name}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(v.id)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
            aria-label={t('deleteAria', { name: v.name })}
          >
            ✕
          </button>
        </span>
      ))}
      {hasFilters && (
        <button
          type="button"
          onClick={() => setShowSave(true)}
          className="rounded-full border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          title={t('saveCurrentTitle')}
        >
          {t('saveView')}
        </button>
      )}

      {showSave && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSave(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-lg"
          >
            <h3 className="mb-2 text-base font-bold">{t('saveFilterTitle')}</h3>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{t('saveHint')}</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder={t('namePlaceholder')}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSave(false)}
                className="rounded-[var(--radius)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-secondary)]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim()}
                className="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
