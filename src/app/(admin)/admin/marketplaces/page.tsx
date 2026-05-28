'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import type { TabKey } from './_shared';
import { ProductsTab } from './_components/ProductsTab';
import { HistoryTab } from './_components/HistoryTab';
import { MessagesTab } from './_components/MessagesTab';
import { AnalyticsTab } from './_components/AnalyticsTab';
import { SettingsTab } from './_components/SettingsTab';
import OnboardingWizard from './_components/OnboardingWizard';
import CompareModal from './_components/CompareModal';

const VALID_TABS: readonly TabKey[] = ['products', 'history', 'messages', 'analytics', 'settings'];

function readTabFromUrl(param: string | null): TabKey {
  return (VALID_TABS as readonly string[]).includes(param || '') ? (param as TabKey) : 'products';
}

export default function MarketplacesPage() {
  const t = useTranslations('admin.marketplacesPage');
  // Read initial tab from ?tab= on the client. SSR runs with window
  // undefined and falls back to 'products'; a quick client-side correction
  // in useEffect below switches if the URL says otherwise (avoids forcing
  // useSearchParams + Suspense gymnastics for what is pure client state).
  const [tab, setTab] = useState<TabKey>('products');
  const [messageCount, setMessageCount] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);

  // Apply URL → state on mount and whenever the user navigates back/forward.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const next = readTabFromUrl(new URL(window.location.href).searchParams.get('tab'));
      setTab((prev) => (prev === next ? prev : next));
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  // Mirror `tab` into ?tab= without pushing history entries — page refresh
  // or share-link both land on the same tab the user was on.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get('tab');
    if (current === tab || (current == null && tab === 'products')) return;
    if (tab === 'products') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState(window.history.state, '', url.toString());
  }, [tab]);

  // Unread-message badge poll. Runs once on mount and every 60s thereafter —
  // intentionally NOT in `[tab]` so clicking through tabs doesn't fire an
  // extra fetch each time (the badge value is identical no matter which tab
  // is open). `countOnly=1` returns just the integer — no message bodies, no
  // ~100KB JSON. Cheap enough that multiple tabs polling is fine.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiClient
        .get<{ unreadCount: number }>('/api/v1/admin/marketplaces/messages?countOnly=1')
        .then((res) => {
          if (cancelled) return;
          if (res.success && res.data) {
            setMessageCount(res.data.unreadCount);
          }
        });
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // One-shot refresh when the user opens Messages — keeps the badge accurate
  // without coupling the polling interval to tab switching.
  useEffect(() => {
    if (tab !== 'messages') return;
    let cancelled = false;
    apiClient
      .get<{ unreadCount: number }>('/api/v1/admin/marketplaces/messages?countOnly=1')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setMessageCount(res.data.unreadCount);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'products', label: t('tabProducts') },
    { key: 'history', label: t('tabHistory') },
    { key: 'messages', label: t('tabMessages'), badge: messageCount },
    { key: 'analytics', label: t('tabAnalytics') },
    { key: 'settings', label: t('tabSettings') },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        {/* Header sub-nav: most-used surfaced, rest tucked into ⋯ menu so
            the header stops looking like a wall of buttons. */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin/marketplaces/categories"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            {t('navCategories')}
          </Link>
          <Link
            href="/admin/marketplaces/returns"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            {t('navReturns')}
          </Link>
          <Link
            href="/admin/marketplaces/pick-list"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            {t('navPickList')}
          </Link>
          <button
            onClick={() => setCompareOpen(true)}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
          >
            {t('navCompare')}
          </button>
          <MoreMenu />
        </div>
      </div>

      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} />

      <OnboardingWizard />

      <AttentionPanel />

      <div className="mb-6 flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`relative rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${tab === tabItem.key ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
          >
            {tabItem.label}
            {tabItem.badge ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {tabItem.badge > 99 ? '99+' : tabItem.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

/** Overflow menu for less-frequent marketplace pages. Closes on outside click. */
function MoreMenu() {
  const t = useTranslations('admin.marketplacesPage');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const items = [
    // Disputes / Pricing parity / Repricing now live in <AttentionPanel /> so
    // they surface with live counts above the tabs. Keeping them out of this
    // overflow menu prevents the same destination appearing twice.
    { href: '/admin/marketplaces/buyer', label: t('moreBuyer'), icon: '👤' },
    { href: '/admin/marketplaces/audit', label: t('moreAudit'), icon: '📜' },
    { href: '/admin/marketplaces/help', label: t('moreHelp'), icon: '❓' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-bg-secondary)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('moreMenu')}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              <span aria-hidden>{it.icon}</span>
              <span>{it.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * AttentionPanel — surfaces revenue-critical issues (disputes, pricing
 * mismatches) directly above the tabs so they stop hiding behind ⋯ Інше.
 *
 * The original UX hid Disputes and Pricing parity in an overflow menu, which
 * meant lost money sat unattended. This panel reads the counts once on mount
 * and renders three pill-buttons with live badges. Repricing has no global
 * count endpoint, so it appears as a plain link.
 *
 * If everything is 0 the whole panel collapses to a single quiet "Все ок" pill
 * (rather than disappearing) so the user gets an explicit "I checked, nothing
 * to do" signal instead of an unexplained absence.
 */
function AttentionPanel() {
  const t = useTranslations('admin.marketplacesPage');
  const [disputes, setDisputes] = useState<number | null>(null);
  const [parity, setParity] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<{ total: number }>('/api/v1/admin/marketplaces/disputes').then((res) => {
      if (cancelled) return;
      setDisputes(res.success && res.data ? res.data.total : 0);
    });
    apiClient.get<{ total: number }>('/api/v1/admin/marketplaces/pricing-parity').then((res) => {
      if (cancelled) return;
      setParity(res.success && res.data ? res.data.total : 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = disputes === null || parity === null;
  if (loading) return null;

  const allClear = disputes === 0 && parity === 0;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
        {t('attentionLabel')}
      </span>
      {allClear ? (
        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-700">
          {t('allClear')}
        </span>
      ) : (
        <>
          <AttentionPill
            href="/admin/marketplaces/disputes"
            label={t('pillDisputes')}
            count={disputes}
            tone="danger"
            title={t('pillDisputesTitle')}
          />
          <AttentionPill
            href="/admin/marketplaces/pricing-parity"
            label={t('pillParity')}
            count={parity}
            tone="warn"
            title={t('pillParityTitle')}
          />
        </>
      )}
      <Link
        href="/admin/marketplaces/repricing"
        className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
        title={t('linkRepricingTitle')}
      >
        {t('linkRepricing')}
      </Link>
    </div>
  );
}

function AttentionPill({
  href,
  label,
  count,
  tone,
  title,
}: {
  href: string;
  label: string;
  count: number;
  tone: 'danger' | 'warn';
  title?: string;
}) {
  const cls =
    count === 0
      ? 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
      : tone === 'danger'
        ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';
  return (
    <Link
      href={href}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${cls}`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
          count === 0 ? 'bg-[var(--color-bg-secondary)]' : 'bg-white/70'
        }`}
      >
        {count > 99 ? '99+' : count}
      </span>
    </Link>
  );
}
