'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';
import CameraBarcodeScanner from '@/components/admin/CameraBarcodeScanner';

interface StockCountItem {
  id: number;
  productId: number;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  product: { id: number; name: string; code: string };
  countedAt: string | null;
}

interface StockCountDetail {
  id: number;
  reference: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  warehouse: { id: number; name: string };
  startedAt: string;
  completedAt: string | null;
  comment: string | null;
  items: StockCountItem[];
}

export default function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [count, setCount] = useState<StockCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState('');
  const [scanQty, setScanQty] = useState(1);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'counted' | 'pending' | 'variance'>('all');

  const load = async () => {
    const res = await apiClient.get<StockCountDetail>(`/api/v1/admin/stock-counts/${id}`);
    if (res.success && res.data) setCount(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleScan = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || !count) return;
    setScanValue('');
    const res = await apiClient.post(`/api/v1/admin/stock-counts/${count.id}/scan`, {
      code,
      quantity: scanQty,
    });
    if (res.success) {
      toast.success(`✓ ${code} → ${scanQty}`);
      load();
    } else {
      toast.error(res.error || 'Помилка сканування');
    }
    setTimeout(() => scanRef.current?.focus(), 30);
  };

  const complete = async () => {
    if (!confirm('Закрити інвентаризацію та оновити залишки на складі?')) return;
    setBusy(true);
    const res = await apiClient.put<StockCountDetail>(
      `/api/v1/admin/stock-counts/${id}`,
      { action: 'complete' },
    );
    setBusy(false);
    if (res.success && res.data) {
      setCount(res.data);
      toast.success('Інвентаризацію завершено');
    } else {
      setError(res.error || 'Помилка');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!count) {
    return (
      <div>
        <p>Не знайдено</p>
        <Button variant="outline" onClick={() => router.push('/admin/stock-counts')}>
          До списку
        </Button>
      </div>
    );
  }

  const counted = count.items.filter((i) => i.countedQty !== null).length;
  const withVariance = count.items.filter(
    (i) => i.variance !== null && i.variance !== 0,
  ).length;

  const filtered =
    filter === 'all'
      ? count.items
      : filter === 'counted'
        ? count.items.filter((i) => i.countedQty !== null)
        : filter === 'pending'
          ? count.items.filter((i) => i.countedQty === null)
          : count.items.filter((i) => i.variance !== null && i.variance !== 0);

  return (
    <div>
      <Link
        href="/admin/stock-counts"
        className="text-sm text-[var(--color-primary)] hover:underline"
      >
        &larr; До списку
      </Link>

      <div className="mt-4 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold">{count.reference}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {count.warehouse.name} ·{' '}
            {new Date(count.startedAt).toLocaleString('uk-UA')}
          </p>
        </div>
        {count.status === 'in_progress' && (
          <Button onClick={complete} isLoading={busy} disabled={counted === 0}>
            Завершити інвентаризацію
          </Button>
        )}
        {count.status === 'completed' && (
          <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            Закрито
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius)] bg-red-50 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {count.status === 'in_progress' && (
        <div className="mb-5 rounded-[var(--radius)] border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                Код товару
              </label>
              <input
                ref={scanRef}
                autoFocus
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScan(scanValue);
                }}
                placeholder="Скануйте або введіть артикул…"
                className="w-full rounded-[var(--radius)] border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-bg)] px-3 py-2 text-base outline-none focus:border-solid"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                Кількість
              </label>
              <input
                type="number"
                min={0}
                value={scanQty}
                onChange={(e) => setScanQty(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right text-base tabular-nums"
              />
            </div>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-2xl hover:bg-[var(--color-bg-secondary)]"
              title="Сканувати камерою"
            >
              📷
            </button>
          </div>
          <CameraBarcodeScanner
            isOpen={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onScan={(code) => handleScan(code)}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`Усі (${count.items.length})`}
        />
        <FilterPill
          active={filter === 'counted'}
          onClick={() => setFilter('counted')}
          label={`Підраховано (${counted})`}
        />
        <FilterPill
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
          label={`Очікують (${count.items.length - counted})`}
        />
        <FilterPill
          active={filter === 'variance'}
          onClick={() => setFilter('variance')}
          label={`Розбіжності (${withVariance})`}
        />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-3 py-2 text-left font-medium">Артикул</th>
              <th className="px-3 py-2 text-left font-medium">Товар</th>
              <th className="px-3 py-2 text-right font-medium">Очікувано</th>
              <th className="px-3 py-2 text-right font-medium">Підраховано</th>
              <th className="px-3 py-2 text-right font-medium">Розбіжність</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-[var(--color-border)] last:border-0 ${
                  item.variance !== null && item.variance !== 0 ? 'bg-amber-50/40' : ''
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{item.product.code}</td>
                <td className="px-3 py-2">{item.product.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.expectedQty}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.countedQty !== null ? item.countedQty : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {item.variance !== null && item.variance !== 0 ? (
                    <span
                      className={`tabular-nums font-medium ${
                        item.variance > 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {item.variance > 0 ? '+' : ''}
                      {item.variance}
                    </span>
                  ) : item.variance === 0 ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-medium transition-colors ${
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
          : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'
      }`}
    >
      {label}
    </button>
  );
}
