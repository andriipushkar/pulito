'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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

const STATUS_COLOR: Record<Status, string> = {
  forming: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function PalletListSection() {
  const t = useTranslations('admin.palletListSection');
  const STATUS_LABEL = useMemo<Record<Status, string>>(
    () => ({
      forming: t('statusForming'),
      in_transit: t('statusInTransit'),
      delivered: t('statusDelivered'),
      cancelled: t('statusCancelled'),
    }),
    [t],
  );
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newCarrier, setNewCarrier] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const [orderIdsInput, setOrderIdsInput] = useState<Record<number, string>>({});

  const load = async () => {
    setIsLoading(true);
    // Endpoint now returns paginated envelope { items, total, page, limit }.
    // 100 limit covers the realistic in-progress pallet count; if it ever
    // outgrows that, add UI pagination — not needed today.
    const res = await apiClient.get<{ items: Pallet[]; total: number }>(
      '/api/v1/admin/pallets?limit=100',
    );
    if (res.success && res.data) setPallets(res.data.items);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createPallet = async () => {
    if (!newName.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    const res = await apiClient.post('/api/v1/admin/pallets', {
      name: newName.trim(),
      region: newRegion.trim() || null,
      carrier: newCarrier.trim() || null,
    });
    if (res.success) {
      toast.success(t('palletCreated'));
      setNewName('');
      setNewRegion('');
      setNewCarrier('');
      setShowCreate(false);
      load();
    } else {
      toast.error(res.error || t('error'));
    }
  };

  const addOrders = async (palletId: number) => {
    const raw = orderIdsInput[palletId] ?? '';
    const ids = raw
      .split(/[\s,;]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      toast.error(t('enterOrderIds'));
      return;
    }
    const res = await apiClient.post(`/api/v1/admin/pallets/${palletId}/orders`, {
      orderIds: ids,
    });
    if (res.success) {
      toast.success(t('ordersAdded', { count: ids.length }));
      setOrderIdsInput((curr) => ({ ...curr, [palletId]: '' }));
      load();
    } else {
      toast.error(res.error || t('error'));
    }
  };

  const removeOrder = async (palletId: number, orderId: number) => {
    if (!window.confirm(t('confirmRemoveOrder', { id: orderId }))) return;
    const res = await apiClient.delete(
      `/api/v1/admin/pallets/${palletId}/orders?orderId=${orderId}`,
    );
    if (res.success) {
      toast.success(t('removed'));
      load();
    } else {
      toast.error(res.error || t('error'));
    }
  };

  // Split into request + initial confirm wrapper so the override path is
  // a single linear flow (no recursion, no chance of stacking confirms with
  // confirmDelete or other modal state).
  const sendStatusUpdate = async (palletId: number, status: Status, forceUnpacked: boolean) => {
    const label = STATUS_LABEL[status];
    const res = await apiClient.put(`/api/v1/admin/pallets/${palletId}/status`, {
      status,
      ...(forceUnpacked ? { forceUnpacked: true } : {}),
    });
    if (res.success) {
      toast.success(t('statusSet', { status: label }));
      load();
      return;
    }
    if (res.statusCode === 409 && status === 'in_transit' && !forceUnpacked) {
      if (window.confirm(t('sendAnyway', { error: res.error ?? '' }))) {
        await sendStatusUpdate(palletId, status, true);
      }
      return;
    }
    toast.error(res.error || t('error'));
  };

  const setStatus = async (palletId: number, status: Status) => {
    const label = STATUS_LABEL[status];
    if (!window.confirm(t('confirmStatus', { status: label }))) return;
    await sendStatusUpdate(palletId, status, false);
  };

  const deletePallet = (palletId: number, name: string) => {
    setConfirmDelete({ id: palletId, name });
  };

  const handleConfirmedDelete = async () => {
    if (!confirmDelete) return;
    const res = await apiClient.delete(`/api/v1/admin/pallets/${confirmDelete.id}`);
    setConfirmDelete(null);
    if (res.success) {
      toast.success(t('removed'));
      load();
    } else {
      toast.error(res.error || t('error'));
    }
  };

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? t('cancel') : t('createPalletToggle')}
        </Button>
      </div>

      {showCreate && (
        <div className="mb-4 grid gap-3 rounded-md border border-[var(--color-border)] p-3 sm:grid-cols-4">
          <Input
            label={t('nameLabel')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('namePlaceholder')}
          />
          <Input
            label={t('regionLabel')}
            value={newRegion}
            onChange={(e) => setNewRegion(e.target.value)}
            placeholder={t('regionPlaceholder')}
          />
          <Input
            label={t('carrierLabel')}
            value={newCarrier}
            onChange={(e) => setNewCarrier(e.target.value)}
            placeholder={t('carrierPlaceholder')}
          />
          <div className="flex items-end">
            <Button onClick={createPallet}>{t('create')}</Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-[var(--color-text-secondary)]">{t('loading')}</div>
      )}
      {!isLoading && pallets.length === 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">{t('empty')}</p>
      )}

      {pallets.length > 0 && (
        <div className="space-y-3">
          {pallets.map((p) => {
            const expanded = expandedId === p.id;
            const totalOrders = p.orders.length;
            const totalAmount = p.orders.reduce((s, po) => s + Number(po.order.totalAmount), 0);
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status]}`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                  {p.region && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      📍 {p.region}
                    </span>
                  )}
                  {p.carrier && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      🚚 {p.carrier}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t('ordersCount', { count: totalOrders })}
                    {totalOrders > 0 && ` · ${formatPrice(totalAmount)}`}
                  </span>
                  {p.weightKg != null && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      ⚖ {t('weight', { weight: Number(p.weightKg) })}
                    </span>
                  )}
                  {p.deliveryCost != null && (
                    <span className="text-xs font-medium text-emerald-700">
                      {t('deliveryCost', { price: formatPrice(Number(p.deliveryCost)) })}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {p.status === 'forming' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(p.id, 'in_transit')}
                      >
                        {t('ship')}
                      </Button>
                    )}
                    {p.status === 'in_transit' && (
                      <Button size="sm" onClick={() => setStatus(p.id, 'delivered')}>
                        {t('statusDelivered')}
                      </Button>
                    )}
                    {(p.status === 'forming' || p.status === 'in_transit') && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setStatus(p.id, 'cancelled')}
                      >
                        {t('cancel')}
                      </Button>
                    )}
                    {p.status !== 'in_transit' && p.status !== 'delivered' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => deletePallet(p.id, p.name)}
                        aria-label={t('deleteAria', { name: p.name })}
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
                        {t('noOrders')}
                      </p>
                    )}
                    {p.orders.length > 0 && (
                      <table className="mb-3 w-full text-sm">
                        <thead>
                          <tr className="text-xs text-[var(--color-text-secondary)]">
                            <th className="px-2 py-1 text-left">{t('colOrder')}</th>
                            <th className="px-2 py-1 text-left">{t('colClient')}</th>
                            <th className="px-2 py-1 text-left">{t('colCity')}</th>
                            <th className="px-2 py-1 text-right">{t('colSum')}</th>
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
                                    {t('removeLink')}
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
                            label={t('addOrdersLabel')}
                            value={orderIdsInput[p.id] ?? ''}
                            onChange={(e) =>
                              setOrderIdsInput((curr) => ({ ...curr, [p.id]: e.target.value }))
                            }
                            placeholder="123, 124, 125"
                          />
                        </div>
                        <Button onClick={() => addOrders(p.id)}>{t('add')}</Button>
                      </div>
                    )}

                    {p.notes && (
                      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        {t('notes', { notes: p.notes })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmedDelete}
        variant="danger"
        title={t('deleteTitle')}
        message={t('deleteMessage', { name: confirmDelete?.name ?? '' })}
        confirmText={t('deleteConfirm')}
      />
    </div>
  );
}
