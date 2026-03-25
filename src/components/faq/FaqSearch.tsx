'use client';

import { useState, useRef } from 'react';
import { Search } from '@/components/icons';

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

interface FaqSearchProps {
  onResults: (results: FaqItem[] | null) => void;
  onQueryChange?: (query: string) => void;
}

export default function FaqSearch({ onResults, onQueryChange }: FaqSearchProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = (value: string) => {
    setQuery(value);
    onQueryChange?.(value);
    clearTimeout(timerRef.current);

    if (value.length < 2) {
      onResults(null);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/faq/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data.success) {
          onResults(data.data);
        }
      } catch {}
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Пошук у FAQ..."
        aria-label="Пошук у FAQ"
        className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-3 pl-10 pr-4 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      />
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}
