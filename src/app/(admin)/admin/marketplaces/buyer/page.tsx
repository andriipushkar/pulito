'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface OrderRow {
  id: number;
  orderNumber: string;
  externalId: string | null;
  source: string;
  status: string;
  totalAmount: number;
  contactName: string;
  contactPhone: string;
  createdAt: string;
  trackingNumber: string | null;
  itemsCount: number;
  items: { productName: string; quantity: number; priceAtOrder: number }[];
  returns: { id: number; status: string; reason: string | null; refundAmount: number | null; createdAt: string }[];
}

interface MessageRow {
  id: string;
  platform: string;
  buyerName: string;
  text: string;
  receivedAt: string;
  isRead: boolean;
  firstRespondedAt: string | null;
}

interface BuyerData {
  query: { phone: string; name: string };
  stats: {
    ordersCount: number;
    completedOrders: number;
    cancelledOrders: number;
    totalSpent: number;
    returnsCount: number;
    unreadMessages: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  };
  orders: OrderRow[];
  messages: MessageRow[];
}

const PLATFORM_ICON: Record<string, string> = {
  olx: '🟢',
  rozetka: '🟩',
  prom: '🔵',
  epicentrk: '🟠',
};

export default function MarketplaceBuyerPage() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [data, setData] = useState<BuyerData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!phone.trim() && !name.trim()) {
      toast.error('Введіть телефон або ім\'я');
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (phone.trim()) params.set('phone', phone.trim());
    if (name.trim()) params.set('name', name.trim());

    const res = await apiClient.get<BuyerData>(`/api/v1/admin/marketplaces/buyer?${params}`);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      toast.error(res.error || 'Помилка пошуку');
      setData(null);
    }
    setLoading(false);
  };

  const formatMoney = (n: number) => `${n.toFixed(2)} грн`;
  const formatDate = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/marketplaces"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Маркетплейси
        </Link>
        <h2 className="mt-1 text-xl font-bold">Картка покупця</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Шукайте покупця за телефоном або іменем — побачите всі замовлення, повідомлення та
          повернення в одному місці.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <label className="flex-1 min-w-[200px]">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Телефон</span>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+380501234567"
          />
        </label>
        <label className="flex-1 min-w-[200px]">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Ім&apos;я</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Іван Петренко"
          />
        </label>
        <Button onClick={handleSearch} isLoading={loading}>
          Знайти
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs text-[var(--color-text-secondary)]">Замовлень</p>
              <p className="mt-1 text-2xl font-bold">{data.stats.ordersCount}</p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                ✓ {data.stats.completedOrders} · ✕ {data.stats.cancelledOrders}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs text-[var(--color-text-secondary)]">Сума</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(data.stats.totalSpent)}</p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">без скасованих</p>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs text-[var(--color-text-secondary)]">Повернень</p>
              <p
                className={`mt-1 text-2xl font-bold ${data.stats.returnsCount > 0 ? 'text-amber-600' : ''}`}
              >
                {data.stats.returnsCount}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs text-[var(--color-text-secondary)]">Повідомлень</p>
              <p className="mt-1 text-2xl font-bold">{data.messages.length}</p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                непрочитаних: <strong>{data.stats.unreadMessages}</strong>
              </p>
            </div>
          </div>

          <div className="text-xs text-[var(--color-text-secondary)]">
            Перше замовлення: <strong>{formatDate(data.stats.firstOrderAt)}</strong> · Останнє:{' '}
            <strong>{formatDate(data.stats.lastOrderAt)}</strong>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold">
              Замовлення ({data.orders.length})
            </h3>
            {data.orders.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-text-secondary)]">
                Замовлень не знайдено
              </p>
            ) : (
              <div className="space-y-2">
                {data.orders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                      <span>{PLATFORM_ICON[o.source] || '📦'}</span>
                      <strong>{o.orderNumber}</strong>
                      <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px]">
                        {o.status}
                      </span>
                      {o.trackingNumber && (
                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                          TTN: {o.trackingNumber}
                        </span>
                      )}
                      <span className="ml-auto font-semibold">{formatMoney(o.totalAmount)}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {formatDate(o.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {o.contactName} · {o.contactPhone} · {o.itemsCount} од.
                    </div>
                    <ul className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                      {o.items.slice(0, 3).map((i, idx) => (
                        <li key={idx}>
                          • {i.productName} × {i.quantity}
                        </li>
                      ))}
                      {o.items.length > 3 && <li>...та ще {o.items.length - 3}</li>}
                    </ul>
                    {o.returns.length > 0 && (
                      <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Повернень: {o.returns.length} (
                        {o.returns.map((r) => r.status).join(', ')})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold">
              Повідомлення ({data.messages.length})
            </h3>
            {data.messages.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-text-secondary)]">
                {name
                  ? 'Повідомлень не знайдено'
                  : 'Введіть ім\'я для пошуку повідомлень (телефон в повідомленнях не зберігається)'}
              </p>
            ) : (
              <div className="space-y-2">
                {data.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-[var(--radius)] border p-3 text-sm ${
                      m.isRead
                        ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
                        : 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <span>{PLATFORM_ICON[m.platform] || '📦'}</span>
                      <strong>{m.buyerName}</strong>
                      {!m.isRead && (
                        <span className="rounded bg-[var(--color-primary)] px-1 py-0.5 text-[9px] text-white">
                          Нове
                        </span>
                      )}
                      {m.firstRespondedAt && (
                        <span className="text-[10px] text-green-600">✓ відповіли</span>
                      )}
                      <span className="ml-auto">{formatDate(m.receivedAt)}</span>
                    </div>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
