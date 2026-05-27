'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { MARKETPLACES, type HealthStatus } from '../_shared';
import { HealthBadge } from './HealthBadge';

type ConfigSummary = { platform: string; isActive: boolean };

interface CompareModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Side-by-side marketplace comparison modal — lets the manager pick two
 * platforms and see config + health + listing counts in adjacent columns.
 * Faster than tab-flipping between Settings entries when deciding "should I
 * relist this on Rozetka or stay on OLX?".
 *
 * Keep the data calls minimal — we already have the configs cached in
 * SettingsTab, but here we re-fetch on open so we don't depend on tab order.
 */
export default function CompareModal({ open, onClose }: CompareModalProps) {
  const [leftKey, setLeftKey] = useState<string>(MARKETPLACES[0]?.key ?? 'olx');
  const [rightKey, setRightKey] = useState<string>(MARKETPLACES[1]?.key ?? 'rozetka');
  const [configs, setConfigs] = useState<Record<string, ConfigSummary | null>>({});
  const [statuses, setStatuses] = useState<Record<string, HealthStatus | null>>({});
  const [listingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    apiClient
      .get<ConfigSummary[]>('/api/v1/admin/marketplaces')
      .then((res) => {
        if (!res.success || !res.data) return;
        const cfgMap: Record<string, ConfigSummary> = {};
        for (const c of res.data) cfgMap[c.platform] = c;
        setConfigs(cfgMap);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    for (const key of [leftKey, rightKey]) {
      apiClient
        .get<HealthStatus>(`/api/v1/admin/marketplaces/${key}/test`)
        .then((res) => {
          if (res.success && res.data) {
            setStatuses((prev) => ({ ...prev, [key]: res.data ?? null }));
          }
        })
        .catch(() => {});
    }
  }, [open, leftKey, rightKey]);

  if (!open) return null;

  const left = MARKETPLACES.find((m) => m.key === leftKey);
  const right = MARKETPLACES.find((m) => m.key === rightKey);

  const renderColumn = (selectedKey: string, onChange: (v: string) => void, other: string) => {
    const platform = MARKETPLACES.find((m) => m.key === selectedKey);
    const cfg = configs[selectedKey];
    const health = statuses[selectedKey];
    const enabled = !!cfg?.isActive;

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <select
          value={selectedKey}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-semibold"
        >
          {MARKETPLACES.filter((m) => m.key !== other).map((m) => (
            <option key={m.key} value={m.key}>
              {m.icon} {m.name}
            </option>
          ))}
        </select>

        <div className="space-y-2 text-sm">
          <Row label="Статус">
            <HealthBadge health={health ?? null} enabled={enabled} />
          </Row>
          <Row label="Активний">{enabled ? '✅' : '❌'}</Row>
          <Row label="Підтримує товари">{platform?.supports?.products ? '✅' : '➖'}</Row>
          <Row label="Підтримує stock sync">{platform?.supports?.stock ? '✅' : '➖'}</Row>
          <Row label="Підтримує замовлення">{platform?.supports?.orders ? '✅' : '➖'}</Row>
          <Row label="Listings published">{listingCounts[selectedKey] ?? '—'}</Row>
          <Row label="Документація">
            <a
              href={platform?.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {platform?.docsLabel ?? 'Відкрити ↗'}
            </a>
          </Row>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-[var(--color-bg)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Порівняти маркетплейси</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {renderColumn(leftKey, setLeftKey, rightKey)}
          {renderColumn(rightKey, setRightKey, leftKey)}
        </div>
        <p className="mt-4 text-center text-[11px] text-[var(--color-text-secondary)]">
          {left?.name} vs {right?.name} — обирайте платформу зверху кожної колонки.
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)]/50 py-1 last:border-0">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-xs">{children}</span>
    </div>
  );
}
