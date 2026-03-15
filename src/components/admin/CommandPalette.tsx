'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface CommandItem {
  label: string;
  href: string;
  icon: string;
  section?: string;
}

const COMMANDS: CommandItem[] = [
  { label: 'Dashboard', href: '/admin', icon: '📊' },
  { label: 'Замовлення', href: '/admin/orders', icon: '📦', section: 'Основне' },
  { label: 'Товари', href: '/admin/products', icon: '🛒', section: 'Основне' },
  { label: 'Користувачі', href: '/admin/users', icon: '👥', section: 'Основне' },
  { label: 'Аналітика', href: '/admin/analytics', icon: '📈', section: 'Основне' },
  { label: 'Звіти', href: '/admin/reports', icon: '📊', section: 'Основне' },
  { label: 'Категорії', href: '/admin/categories', icon: '📁', section: 'Контент' },
  { label: 'Сторінки', href: '/admin/pages', icon: '📄', section: 'Контент' },
  { label: 'FAQ', href: '/admin/faq', icon: '❓', section: 'Контент' },
  { label: 'Імпорт', href: '/admin/import', icon: '📥', section: 'Контент' },
  { label: 'Публікації', href: '/admin/publications', icon: '📢', section: 'Контент' },
  { label: 'Бейджі', href: '/admin/badges', icon: '🏷️', section: 'Контент' },
  { label: 'Персональні ціни', href: '/admin/personal-prices', icon: '💰', section: 'Контент' },
  { label: 'Оптові правила', href: '/admin/wholesale-rules', icon: '📦', section: 'Контент' },
  { label: 'Реферали', href: '/admin/referrals', icon: '🔗', section: 'Контент' },
  { label: 'Лояльність', href: '/admin/loyalty', icon: '⭐', section: 'Контент' },
  { label: 'Email-шаблони', href: '/admin/email-templates', icon: '📧', section: 'Контент' },
  { label: 'Зворотний зв\'язок', href: '/admin/feedback', icon: '💬', section: 'Контент' },
  { label: 'Статистика каналів', href: '/admin/channels', icon: '📡', section: 'Канали' },
  { label: 'Налаштування каналів', href: '/admin/channel-settings', icon: '🔧', section: 'Канали' },
  { label: 'Налаштування ботів', href: '/admin/bot-settings', icon: '🤖', section: 'Канали' },
  { label: 'Модерація', href: '/admin/moderation', icon: '🛡️', section: 'Канали' },
  { label: 'Маркетплейси', href: '/admin/marketplaces', icon: '🏪', section: 'Маркетплейси' },
  { label: 'Загальні налаштування', href: '/admin/settings', icon: '⚙️', section: 'Налаштування' },
  { label: 'Платіжні системи', href: '/admin/payment-settings', icon: '💳', section: 'Налаштування' },
  { label: 'Служби доставки', href: '/admin/delivery-settings', icon: '🚚', section: 'Налаштування' },
  { label: 'Email / SMTP', href: '/admin/smtp-settings', icon: '📧', section: 'Налаштування' },
  { label: 'Головна сторінка', href: '/admin/homepage', icon: '🏠', section: 'Налаштування' },
  { label: 'Банери', href: '/admin/banners', icon: '🖼️', section: 'Налаштування' },
  { label: 'Теми', href: '/admin/themes', icon: '🎨', section: 'Налаштування' },
  { label: 'SEO-шаблони', href: '/admin/seo-templates', icon: '🔍', section: 'Налаштування' },
  { label: 'SEO-аудит', href: '/admin/seo-audit', icon: '🔗', section: 'Налаштування' },
  { label: 'Журнал дій', href: '/admin/audit-log', icon: '📋', section: 'Налаштування' },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.href.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === 'k' && e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((p) => !p);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const navigate = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true" aria-label="Швидкий перехід">
      <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4">
          <svg className="h-5 w-5 shrink-0 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Перейти до..."
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-[var(--color-text-secondary)]"
          />
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              Нічого не знайдено
            </p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  i === selectedIndex
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.section && (
                  <span className={`ml-auto text-xs ${i === selectedIndex ? 'text-white/70' : 'text-[var(--color-text-secondary)]'}`}>
                    {item.section}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-2">
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1 font-mono">↑↓</kbd>
            навігація
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1 font-mono">↵</kbd>
            перейти
          </span>
        </div>
      </div>
    </div>
  );
}
