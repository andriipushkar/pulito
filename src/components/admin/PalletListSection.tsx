'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatPrice } from '@/utils/format';

type Status = 'forming' | 'in_transit' | 'delivered' | 'cancelled';

interface PalletOrderRow {
  id: number;
  sortOrder: number;
  order: {
    id: number;
    orderNumber: string;
    status: string;
    contactName: string;
    contactPhone: string;
    deliveryCity: string | null;
    deliveryAddress: string | null;
    totalAmount: string | number;
  };
}

interface Pallet {
  id: number;
  name: string;
  status: Status;
  region: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  weightKg: string | number | null;
  deliveryCost: string | number | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  orders: PalletOrderRow[];
}

const STATUS_LABEL: Record<Status, string> = {
  forming: 'Формується',
  in_transit: 'В дорозі',
  delivered: 'Доставлено',
  cancelled: 'Скасовано',
};

const STATUS_COLOR: Record<Status, string> = {
  forming: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function PalletListSection() {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newCarrier, setNewCarrier] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [orderIdsInput, setOrderIdsInput] = useState<Record<number, string>>({});

  const load = async () => {
    setIsLoading(true);
    const res = await apiClient.get<Pallet[]>('/api/v1/admin/pallets');
    if (res.success && res.data) setPallets(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createPallet = async () => {
    if (!newName.trim()) {
      toast.error('Назва обовʼязкова');
      return;
    }
    const res = await apiClient.post('/api/v1/admin/pallets', {
      name: newName.trim(),
      region: newRegion.trim() || null,
      carrier: newCarrier.trim() || null,
    });
    if (res.success) {
      toast.success('Палету створено');
      setNewName('');
      setNewRegion('');
      setNewCarrier('');
      setShowCreate(false);
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const addOrders = async (palletId: number) => {
    const raw = orderIdsInput[palletId] ?? '';
    const ids = raw
      .split(/[\s,;]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      toast.error('Вкажіть ID замовлень (через кому або пробіл)');
      return;
    }
    const res = await apiClient.post(`/api/v1/admin/pallets/${palletId}/orders`, {
      orderIds: ids,
    });
    if (res.success) {
      toast.success(`Додано ${ids.length} замовлень`);
      setOrderIdsInput((curr) => ({ ...curr, [palletId]: '' }));
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const removeOrder = async (palletId: number, orderId: number) => {
    if (!window.confirm(`Видалити замовлення #${orderId} з палети?`)) return;
    const res = await apiClient.delete(`/api/v1/admin/pallets/${palletId}/orders?orderId=${orderId}`);
    if (res.success) {
      toast.success('Видалено');
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const setStatus = async (palletId: number, status: Status, forceUnpacked = false) => {
    const label = STATUS_LABEL[status];
    if (!forceUnpacked && !window.confirm(`Перевести палету у статус "${label}"?`)) return;
    const res = await apiClient.put(`/api/v1/admin/pallets/${palletId}/status`, {
      status,
      ...(forceUnpacked ? { forceUnpacked: true } : {}),
    });
    if (res.success) {
      toast.success(`Статус: ${label}`);
      load();
    } else if (res.statusCode === 409 && status === 'in_transit') {
      // Backend refused because some orders aren't packed yet — show the
      // server's detailed message and offer an override.
      if (window.confirm(`${res.error}\n\nВідправити все одно?`)) {
        setStatus(palletId, status, true);
      }
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  const deletePallet = async (palletId: number, name: string) => {
    if (!window.confirm(`Видалити палету "${name}"? Цю дію не можна скасувати.`)) return;
    const res = await apiClient.delete(`/api/v1/admin/pallets/${palletId}`);
    if (res.success) {
      toast.success('Видалено');
      load();
    } else {
      toast.error(res.error || 'Помилка');
    }
  };

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Палети</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Об&apos;єднай B2B-замовлення на одну машину. Вага і вартість розраховуються автоматично з товарів.
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Скасувати' : '+ Створити палету'}
        </Button>
      </div>

      {showCreate && (
        <div className="mb-4 grid gap-3 rounded-md border border-[var(--color-border)] p-3 sm:grid-cols-4">
          <Input
            label="Назва"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Львів-Київ #14"
          />
          <Input
            label="Регіон"
            value={newRegion}
            onChange={(e) => setNewRegion(e.target.value)}
            placeholder="Київ та область"
          />
          <Input
            label="Перевізник"
            value={newCarrier}
            onChange={(e) => setNewCarrier(e.target.value)}
            placeholder="Делівері, INTIME…"
          />
          <div className="flex items-end">
            <Button onClick={createPallet}>Створити</Button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-sm text-[var(--color-text-secondary)]">Завантаження…</div>}
      {!isLoading && pallets.length === 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Палет ще немає. Створи першу, щоб об&apos;єднати замовлення в одну доставку.
        </p>
      )}

      {pallets.length > 0 && (
        <div className="space-y-3">
          {pallets.map((p) => {
            const expanded = expandedId === p.id;
            const totalOrders = p.orders.length;
            const totalAmount = p.orders.reduce(
              (s, po) => s + Number(po.order.totalAmount),
              0,
            );
            return (
              <div key={p.id} className="rounded-md border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="text-left font-semibold hover:underline"
                  >
                    {expanded ? '▾' : '▸'} {p.name}
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  {p.region && (
                    <span className="text-xs text-[var(--color-text-secondary)]">📍 {p.region}</span>
                  )}
                  {p.carrier && (
                    <span className="text-xs text-[var(--color-text-secondary)]">🚚 {p.carrier}</span>
                  )}
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {totalOrders} замовлень
                    {totalOrders > 0 && ` · ${formatPrice(totalAmount)}`}
                  </span>
                  {p.weightKg != null && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      ⚖ {Number(p.weightKg)} кг
                    </span>
                  )}
                  {p.deliveryCost != null && (
                    <span className="text-xs font-medium text-emerald-700">
                      доставка: {formatPrice(Number(p.deliveryCost))}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {p.status === 'forming' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(p.id, 'in_transit')}>
                        Відправити →
                      </Button>
                    )}
                    {p.status === 'in_transit' && (
                      <Button size="sm" onClick={() => setStatus(p.id, 'delivered')}>
                        Доставлено
                      </Button>
                    )}
                    {(p.status === 'forming' || p.status === 'in_transit') && (
                      <Button size="sm" variant="danger" onClick={() => setStatus(p.id, 'cancelled')}>
                        Скасувати
                      </Button>
                    )}
                    {p.status !== 'in_transit' && p.status !== 'delivered' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => deletePallet(p.id, p.name)}
                        aria-label={`Видалити палет ${p.name}`}
                      >
                        🗑
                      </Button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    {p.orders.length === 0 && (
                      <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
                        У палеті ще немає замовлень.
                      </p>
                    )}
                    {p.orders.length > 0 && (
                      <table className="mb-3 w-full text-sm">
                        <thead>
                          <tr className="text-xs text-[var(--color-text-secondary)]">
                            <th className="px-2 py-1 text-left">Замовл.</th>
                            <th className="px-2 py-1 text-left">Клієнт</th>
                            <th className="px-2 py-1 text-left">Місто</th>
                            <th className="px-2 py-1 text-right">Сума</th>
                            <th className="px-2 py-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.orders.map((po) => (
                            <tr key={po.id} className="border-t border-[var(--color-border)]">
                              <td className="px-2 py-1">
                                <a
                                  href={`/admin/orders/${po.order.id}`}
                                  className="font-medium text-[var(--color-primary)] hover:underline"
                                >
                                  #{po.order.orderNumber}
                                </a>
                              </td>
                              <td className="px-2 py-1">{po.order.contactName}</td>
                              <td className="px-2 py-1">{po.order.deliveryCity ?? '—'}</td>
                              <td className="px-2 py-1 text-right">
                                {formatPrice(Number(po.order.totalAmount))}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {p.status === 'forming' && (
                                  <button
                                    type="button"
                                    onClick={() => removeOrder(p.id, po.order.id)}
                                    className="text-xs text-[var(--color-danger)] hover:underline"
                                  >
                                    видалити
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {p.status === 'forming' && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[300px]">
                          <Input
                            label="Додати замовлення (ID через кому)"
                            value={orderIdsInput[p.id] ?? ''}
                            onChange={(e) =>
                              setOrderIdsInput((curr) => ({ ...curr, [p.id]: e.target.value }))
                            }
                            placeholder="123, 124, 125"
                          />
                        </div>
                        <Button onClick={() => addOrders(p.id)}>Додати</Button>
                      </div>
                    )}

                    {p.notes && (
                      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        Нотатки: {p.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
