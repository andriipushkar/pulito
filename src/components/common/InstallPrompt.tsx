'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_COOLDOWN_DAYS = 14;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check iOS standalone
    if ((navigator as unknown as { standalone?: boolean }).standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_COOLDOWN_DAYS) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a short delay so user has time to browse
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Track app installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setVisible(false);
    } else {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
    setDeferredPrompt(null);
  }, []);

  if (isInstalled || !visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[76px] z-50 px-4 lg:bottom-4 lg:left-auto lg:right-4 lg:px-0">
      <div className="mx-auto max-w-sm animate-slide-up-fade rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <img
            src="/images/icon-192.png"
            alt="Порошок"
            width={48}
            height={48}
            className="rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Встановити Порошок
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Додайте на головний екран для швидкого доступу до магазину
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Закрити"
            className="shrink-0 rounded-lg p-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            Не зараз
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] active:scale-[0.97]"
          >
            Встановити
          </button>
        </div>
      </div>
    </div>
  );
}
