'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import { formatPrice } from '@/utils/format';
import CameraBarcodeScanner from '@/components/admin/CameraBarcodeScanner';

interface PackOrder {
  id: number;
  orderNumber: string;
  status: string;
  contactName: string;
  contactPhone: string;
  totalAmount: string | number;
  trackingNumber: string | null;
  items: {
    id: number;
    productName: string;
    productCode: string;
    productBarcode?: string | null;
    quantity: number;
    stockOnHand?: number;
    locationCode?: string | null;
    locationName?: string | null;
  }[];
}

/**
 * Pick & Pack — single-purpose workflow for packing day. Optimized for:
 * - Large fonts (operator stands at the desk, not leaning over)
 * - Barcode scanner input (focused permanently; scanner is essentially a keyboard wedge
 *   that "types" the SKU/order number then sends Enter)
 * - Single-key actions: Enter = mark next item picked, P = print labels, N = next order
 * - Touch-friendly buttons for tablets
 */
export default function PackPage() {
  const [orders, setOrders] = useState<PackOrder[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  const refocus = () => {
    setTimeout(() => scanRef.current?.focus(), 30);
  };

  useEffect(() => {
    let cancelled = false;
    // Anything confirmed/paid but not yet shipped is fair game for packing.
    // We surface confirmed first; the API doesn't accept multi-status filters,
    // so we fetch a wider list and filter client-side.
    apiClient
      .get<{ orders: PackOrder[] }>('/api/v1/admin/orders/packable?limit=50')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setOrders(res.data.orders);
          setActiveIdx(0);
          setPicked(new Set());
        }
        setIsLoading(false);
        refocus();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset picked-set + refocus is triggered by each setActiveIdx call site
  // (selectOrder/handleNext/handlePrev), not in an effect. Refocus stays
  // a DOM side-effect.
  const selectOrder = useCallback((idx: number) => {
    setActiveIdx(idx);
    setPicked(new Set());
    refocus();
  }, []);

  const active = orders[activeIdx];
  const allPicked = active && active.items.every((i) => picked.has(i.id));

  const handleScan = (raw: string) => {
    const v = raw.trim();
    if (!v || !active) return;
    setScanValue('');
    // Match priority:
    //  1. productBarcode (real EAN/UPC on the package — what the scanner reads)
    //  2. productCode (internal SKU — for manual entry)
    //  3. exact item ID — debugging / paper labels
    const digits = v.replace(/\D/g, '');
    const item = active.items.find((i) => {
      if (i.productBarcode && digits && i.productBarcode === digits) return true;
      if (i.productCode.toLowerCase() === v.toLowerCase()) return true;
      if (String(i.id) === v) return true;
      return false;
    });
    if (!item) {
      toast.error(`Не знайдено товар з кодом "${v}"`);
      return;
    }
    if (picked.has(item.id)) {
      toast.info(`${item.productName} вже відмічено`);
      return;
    }
    // Stock guard: refuse to mark a row picked if the product is empty. The
    // operator can still override (button below), but the default flow stops
    // the box from going out with a missing item.
    if ((item.stockOnHand ?? 0) < item.quantity) {
      toast.error(
        `Недостатньо на складі: потрібно ${item.quantity}, є ${item.stockOnHand ?? 0}. Підтвердіть вручну.`,
      );
      return;
    }
    setPicked((s) => new Set(s).add(item.id));
    toast.success(`✓ ${item.productName}`);
  };

  // Manual override for the stock check (e.g. operator knows there's an
  // extra unit in the back, but the warehouse stock isn't sync'd yet).
  const forcePick = (itemId: number) => {
    setPicked((s) => new Set(s).add(itemId));
    refocus();
  };

  const updateStatus = async (
    status: 'packed' | 'shipped',
    comment: string,
    successText: string,
  ) => {
    if (!active) return;
    setIsCompleting(true);
    const res = await apiClient.put(`/api/v1/admin/orders/${active.id}/status`, {
      status,
      comment,
    });
    setIsCompleting(false);
    if (res.success) {
      toast.success(`#${active.orderNumber} → ${successText}`);
      // If we went to "packed" we keep the order on the list (still pending
      // courier handoff). If we went to "shipped" we drop it.
      if (status === 'shipped') {
        const next = orders.filter((_, i) => i !== activeIdx);
        setOrders(next);
        selectOrder(Math.min(activeIdx, next.length - 1));
      } else {
        // Just bump status in-place so the UI shows the new state.
        setOrders((curr) =>
          curr.map((o, i) => (i === activeIdx ? { ...o, status: 'packed' } : o)),
        );
        refocus();
      }
    } else {
      toast.error(res.error || 'Не вдалося завершити');
      refocus();
    }
  };

  const handleMarkPacked = () => updateStatus('packed', 'Зібрано', 'упаковано');
  const handlePackComplete = () =>
    updateStatus('shipped', 'Упаковано та передано курʼєру', 'відправлено');

  const handleNext = () => {
    if (activeIdx < orders.length - 1) selectOrder(activeIdx + 1);
  };

  const handlePrev = () => {
    if (activeIdx > 0) selectOrder(activeIdx - 1);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-6xl">📦</div>
        <h1 className="mt-4 text-2xl font-bold">Все упаковано!</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Немає замовлень у статусах «Підтверджено» або «Оплачено».
        </p>
        <Link
          href="/admin/orders"
          className="mt-6 inline-block rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
        >
          До замовлень
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">📦 Pick & Pack</h1>
        <div className="text-sm text-[var(--color-text-secondary)]">
          {activeIdx + 1} / {orders.length}
        </div>
      </div>

      {/* Scanner input — invisible-ish but always focused */}
      <div className="mb-4 flex gap-2">
        <input
          ref={scanRef}
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleScan(scanValue);
          }}
          onBlur={refocus}
          placeholder="Скануйте штрих-код або введіть код товара…"
          className="flex-1 rounded-xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-bg)] px-4 py-3 text-lg outline-none focus:border-solid"
          autoFocus
        />
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-2xl hover:bg-[var(--color-bg-secondary)]"
          aria-label="Сканувати камерою"
          title="Сканувати камерою"
        >
          📷
        </button>
      </div>

      <CameraBarcodeScanner
        isOpen={cameraOpen}
        onClose={() => {
          setCameraOpen(false);
          refocus();
        }}
        onScan={(code) => handleScan(code)}
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Link
              href={`/admin/orders/${active.id}`}
              className="text-2xl font-bold text-[var(--color-primary)] hover:underline"
            >
              №{active.orderNumber}
            </Link>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {active.contactName} · {active.contactPhone}
            </p>
            {active.trackingNumber && (
              <p className="text-sm font-semibold text-violet-700">
                ТТН: {active.trackingNumber}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatPrice(Number(active.totalAmount))}</p>
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">{active.status}</p>
          </div>
        </div>

        <div className="space-y-2">
          {[...active.items]
            // Group by warehouse location so the operator walks the shelves
            // in order instead of zig-zagging. Items without a known location
            // fall to the bottom.
            .sort((a, b) => {
              const la = a.locationCode ?? '￿';
              const lb = b.locationCode ?? '￿';
              if (la !== lb) return la.localeCompare(lb);
              return a.productName.localeCompare(b.productName);
            })
            .map((item) => {
            const isPicked = picked.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPicked((s) => {
                    const next = new Set(s);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                  refocus();
                }}
                className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${
                  isPicked
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    isPicked ? 'bg-emerald-500 text-white' : 'bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  {isPicked ? '✓' : ''}
                </span>
                <div className="flex-1">
                  <p className={`font-medium ${isPicked ? 'line-through opacity-60' : ''}`}>
                    {item.productName}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Код: {item.productCode}
                    {item.locationCode && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">
                        📦 {item.locationCode}{item.locationName ? ` (${item.locationName})` : ''}
                      </span>
                    )}
                    {item.stockOnHand !== undefined && (
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                          item.stockOnHand >= item.quantity
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        склад: {item.stockOnHand}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xl font-bold">×{item.quantity}</span>
                {!isPicked && (item.stockOnHand ?? 0) < item.quantity && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Підтвердити пакування "${item.productName}" попри нестачу на складі?`)) {
                        forcePick(item.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm(`Підтвердити пакування "${item.productName}" попри нестачу на складі?`)) {
                          forcePick(item.id);
                        }
                      }
                    }}
                    className="ml-2 rounded border border-amber-400 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50"
                    title="Override stock check"
                  >
                    Все одно
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIdx === 0}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
          >
            ← Попереднє
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={activeIdx === orders.length - 1}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-40"
          >
            Наступне →
          </button>
          <div className="flex-1" />
          <a
            href={`/api/v1/admin/orders/${active.id}/invoice`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-secondary)]"
          >
            🖨️ Друк
          </a>
          {active.status !== 'packed' && (
            <button
              type="button"
              onClick={handleMarkPacked}
              disabled={!allPicked || isCompleting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-40"
              title="Все зібрано, чекає курʼєра"
            >
              📦 Зібрано
            </button>
          )}
          <button
            type="button"
            onClick={handlePackComplete}
            disabled={!allPicked || isCompleting}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
            title={allPicked ? 'Передано курʼєру' : 'Спочатку відмітьте всі товари'}
          >
            {isCompleting ? 'Зачекайте…' : '✅ Передано курʼєру'}
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--color-text-secondary)]">
        💡 Сканер штрих-кодів автоматично друкує код у поле вгорі і натискає Enter. Якщо
        сканера немає — клікайте по товарам вручну.
      </p>
    </div>
  );
}
