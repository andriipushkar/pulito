'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

interface SearchProduct {
  id: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: string;
  quantity: number;
  imagePath: string | null;
}

interface SearchCategory {
  id: number;
  name: string;
  slug: string;
  _count: { products: number };
}

interface SearchResults {
  products: SearchProduct[];
  categories: SearchCategory[];
}

interface HistoryEntry {
  id: number;
  query: string;
  createdAt: string;
}

function highlightMatch(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-[var(--color-primary-50)] px-0.5 text-[var(--color-primary-dark)]">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function SearchBar() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mobileFullscreen, setMobileFullscreen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Завантаження історії пошуку
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient.get<HistoryEntry[]>('/api/v1/me/search-history?unique=true&limit=5');
      if (res.success && res.data) {
        setHistory(res.data);
      }
    } catch {
      // silently fail
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Зберегти пошуковий запит в історію
  const saveToHistory = useCallback(async (searchQuery: string) => {
    if (!user || searchQuery.trim().length < 2) return;
    try {
      await apiClient.post('/api/v1/me/search-history', { query: searchQuery.trim() });
      fetchHistory();
    } catch {
      // silently fail
    }
  }, [user, fetchHistory]);

  // Видалити один запис з історії
  const removeHistoryEntry = useCallback(async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiClient.delete(`/api/v1/me/search-history?id=${id}`);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // silently fail
    }
  }, []);

  // Очистити всю історію
  const clearHistory = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiClient.delete('/api/v1/me/search-history');
      setHistory([]);
    } catch {
      // silently fail
    }
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/products/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data);
        setIsOpen(true);
        setShowHistory(false);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setResults(null);
      // Показуємо історію якщо поле порожнє або менше 2 символів
      if (user && history.length > 0) {
        setShowHistory(true);
        setIsOpen(true);
      } else {
        setIsOpen(false);
        setShowHistory(false);
      }
      return;
    }

    setShowHistory(false);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  const handleFocus = () => {
    if (window.innerWidth < 640) {
      setMobileFullscreen(true);
    }
    if (results && query.trim().length >= 2) {
      setIsOpen(true);
      setShowHistory(false);
    } else if (user && history.length > 0 && query.trim().length < 2) {
      setShowHistory(true);
      setIsOpen(true);
    }
  };

  const closeMobileFullscreen = () => {
    setMobileFullscreen(false);
    setIsOpen(false);
    setShowHistory(false);
    inputRef.current?.blur();
  };

  const handleSearch = (searchQuery: string) => {
    saveToHistory(searchQuery);
    setIsOpen(false);
    setShowHistory(false);
    setMobileFullscreen(false);
    window.location.href = `/catalog?search=${encodeURIComponent(searchQuery)}`;
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
    handleSearch(historyQuery);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Збираємо всі suggestion items для keyboard navigation
  const allSuggestions: { type: 'category' | 'product' | 'history'; slug?: string; href: string; query?: string }[] = [];
  if (isOpen && showHistory && history.length > 0) {
    history.forEach((item) => allSuggestions.push({ type: 'history', href: '', query: item.query }));
  } else if (isOpen && !showHistory && results) {
    results.categories.forEach((cat) => allSuggestions.push({ type: 'category', href: `/catalog?category=${cat.slug}` }));
    results.products.forEach((p) => allSuggestions.push({ type: 'product', href: `/product/${p.slug}` }));
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < allSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : allSuggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setShowHistory(false);
      setMobileFullscreen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < allSuggestions.length) {
        e.preventDefault();
        const item = allSuggestions[activeIndex];
        if (item.type === 'history' && item.query) {
          handleHistoryClick(item.query);
        } else if (item.href) {
          saveToHistory(query);
          setIsOpen(false);
          window.location.href = item.href;
        }
        setActiveIndex(-1);
      } else if (query.length >= 2) {
        handleSearch(query);
      }
    }
  };

  // Визначаємо, що показувати: історію чи результати пошуку
  const showHistoryDropdown = isOpen && showHistory && history.length > 0;
  const showResultsDropdown = isOpen && !showHistory && results;

  return (
    <div ref={ref} className={`relative w-full max-w-xl ${mobileFullscreen ? 'fixed inset-0 z-50 flex max-w-none flex-col bg-white p-4 sm:relative sm:inset-auto sm:z-auto sm:flex-row sm:bg-transparent sm:p-0' : ''}`}>
      <div className={`relative ${mobileFullscreen ? 'flex items-center gap-2' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Пошук товарів..."
          className={`w-full rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-2.5 pl-10 pr-4 text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${mobileFullscreen ? 'text-lg' : 'text-sm'}`}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-activedescendant={activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          onFocus={handleFocus}
        />
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {isLoading && (
          <div className={`absolute top-1/2 -translate-y-1/2 ${mobileFullscreen ? 'right-14' : 'right-3'}`}>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}
        {mobileFullscreen && (
          <button
            type="button"
            onClick={closeMobileFullscreen}
            className="shrink-0 p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            aria-label="Закрити пошук"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Випадаючий список історії пошуку */}
      {showHistoryDropdown && (
        <div className={`${mobileFullscreen ? 'mt-2 flex-1 overflow-auto' : 'absolute top-full z-50 mt-1 w-full shadow-[var(--shadow-md)]'} rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]`}>
          <div className="p-2">
            <p className="mb-1 px-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              Історія пошуку
            </p>
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                onClick={() => handleHistoryClick(item.query)}
              >
                <svg className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="min-w-0 flex-1 truncate">{item.query}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="shrink-0 rounded p-0.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
                  onClick={(e) => removeHistoryEntry(item.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      removeHistoryEntry(item.id, e as unknown as React.MouseEvent);
                    }
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-[var(--color-border)] p-2">
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-center text-sm text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]"
              onClick={clearHistory}
            >
              Очистити історію
            </button>
          </div>
        </div>
      )}

      {/* Випадаючий список результатів пошуку */}
      {showResultsDropdown && (
        <div id="search-suggestions" role="listbox" className={`${mobileFullscreen ? 'mt-2 flex-1 overflow-auto' : 'absolute top-full z-50 mt-1 w-full shadow-[var(--shadow-md)]'} rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]`}>
          {results.categories.length > 0 && (
            <div className="border-b border-[var(--color-border)] p-2">
              <p className="mb-1 px-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">Категорії</p>
              {results.categories.map((cat, ci) => (
                <Link
                  key={cat.id}
                  id={`search-suggestion-${ci}`}
                  href={`/catalog?category=${cat.slug}`}
                  className={`block rounded px-2 py-1.5 text-sm hover:bg-[var(--color-bg-secondary)] ${activeIndex === ci ? 'bg-[var(--color-bg-secondary)]' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  {highlightMatch(cat.name, query)} <span className="text-[var(--color-text-secondary)]">({cat._count.products})</span>
                </Link>
              ))}
            </div>
          )}

          {results.products.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">Товари</p>
              {results.products.map((product, pi) => {
                const suggestionIndex = results.categories.length + pi;
                return (
                  <Link
                    key={product.id}
                    id={`search-suggestion-${suggestionIndex}`}
                    href={`/product/${product.slug}`}
                    className={`flex items-center gap-3 rounded px-2 py-1.5 hover:bg-[var(--color-bg-secondary)] ${activeIndex === suggestionIndex ? 'bg-[var(--color-bg-secondary)]' : ''}`}
                    onClick={() => setIsOpen(false)}
                  >
                    {product.imagePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={product.imagePath} alt={product.name} className="h-10 w-10 shrink-0 rounded object-contain" />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded bg-[var(--color-bg-secondary)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{highlightMatch(product.name, query)}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{product.code}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{Number(product.priceRetail).toFixed(2)} ₴</span>
                  </Link>
                );
              })}
            </div>
          )}

          {results.products.length === 0 && results.categories.length === 0 && (
            <div className="p-4 text-center text-sm text-[var(--color-text-secondary)]">
              Нічого не знайдено за запитом &laquo;{query}&raquo;
            </div>
          )}

          {(results.products.length > 0 || results.categories.length > 0) && (
            <div className="border-t border-[var(--color-border)] p-2">
              <Link
                href={`/catalog?search=${encodeURIComponent(query)}`}
                className="block rounded px-2 py-1.5 text-center text-sm text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]"
                onClick={() => {
                  saveToHistory(query);
                  setIsOpen(false);
                }}
              >
                Показати всі результати
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
