'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const COOKIE_CONSENT_KEY = 'cookie-consent-accepted';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_CONSENT_KEY)) setVisible(true);
    } catch { /* SSR / private browsing */ }
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  const saveConsent = async (analyticsAccepted: boolean, marketingAccepted: boolean) => {
    const sessionId = crypto.randomUUID();
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      analytics: analyticsAccepted,
      marketing: marketingAccepted,
      date: new Date().toISOString(),
    }));
    setVisible(false);

    try {
      await fetch('/api/v1/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          sessionId,
          analyticsAccepted,
          marketingAccepted,
        }),
      });
    } catch {
      // Consent saved locally even if API fails
    }
  };

  const handleAcceptAll = () => saveConsent(true, true);
  const handleRejectAll = () => saveConsent(false, false);
  const handleSaveSettings = () => saveConsent(analytics, marketing);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border p-5 shadow-xl sm:left-auto sm:max-w-xl"
      style={{
        backgroundColor: 'var(--color-surface, #ffffff)',
        borderColor: 'var(--color-border, #e2e8f0)',
      }}
    >
      <div className="mx-auto max-w-5xl">
        {!showSettings ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <p className="flex-1 text-sm" style={{ color: 'var(--color-text-secondary, #475569)' }}>
              Ми використовуємо файли cookie для покращення роботи сайту та аналізу трафіку.
              Натискаючи &quot;Прийняти&quot;, ви погоджуєтеся з використанням cookie.{' '}
              <Link href="/pages/privacy-policy" className="underline hover:no-underline" style={{ color: 'var(--color-primary, #2563eb)' }}>
                Політика конфіденційності
              </Link>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRejectAll}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--color-border, #e2e8f0)' }}
              >
                Відхилити все
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--color-border, #e2e8f0)' }}
              >
                Налаштувати
              </button>
              <button
                onClick={handleAcceptAll}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
              >
                Прийняти
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text, #1e293b)' }}>
              Налаштування cookie
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked disabled className="h-4 w-4 rounded" />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary, #475569)' }}>
                  Необхідні (завжди активні)
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary, #475569)' }}>
                  Аналітичні — допомагають покращити сайт
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary, #475569)' }}>
                  Маркетингові — персоналізована реклама
                </span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--color-border, #e2e8f0)' }}
              >
                Назад
              </button>
              <button
                onClick={handleSaveSettings}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
              >
                Зберегти
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
