'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { X, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ORDER_STATUS_COLORS } from '@/types/order';
import type { OrderStatus, PaymentStatus } from '@/types/order';
import { ALLOWED_ORDER_TRANSITIONS } from '@/config/admin-constants';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';

interface OrderDetail {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  createdAt: string;
  managerComment: string | null;
  items: { id: number; productName: string; quantity: number }[];
}

interface Props {
  orderId: number | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function OrderQuickEditDrawer({ orderId, onClose, onUpdated }: Props) {
  const t = useTranslations('admin.orderQuickEdit');
  const tl = useTranslations('admin.orderLabels');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }
    setIsLoading(true);
    apiClient
      .get<OrderDetail>(`/api/v1/admin/orders/${orderId}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrder(res.data);
          setComment(res.data.managerComment || '');
        }
      })
      .finally(() => setIsLoading(false));
  }, [orderId]);

  // Close on Escape
  useEffect(() => {
    if (!orderId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [orderId, onClose]);

  if (!orderId) return null;

  const handleStatusChange = async () => {
    if (!newStatus || !order) return;
    setIsSaving(true);
    const res = await apiClient.put<OrderDetail>(`/api/v1/admin/orders/${order.id}/status`, {
      status: newStatus,
    });
    setIsSaving(false);
    if (res.success) {
      toast.success(t('statusToast', { status: tl(`status.${newStatus}`) }));
      // Use the server response so derived state like paymentStatus (which
      // updateOrderStatus syncs when status → paid) is reflected here, not a
      // stale optimistic merge.
      if (res.data) {
        setOrder(res.data);
      } else {
        setOrder({ ...order, status: newStatus as OrderStatus });
      }
      setNewStatus('');
      onUpdated?.();
    } else {
      toast.error(res.error || t('error'));
    }
  };

  // Mirror the detail page: only the transitions the matrix allows, not every
  // status. Avoids the user picking new_order → shipped and getting a 400.
  const allowedNext = (order ? ALLOWED_ORDER_TRANSITIONS[order.status] || [] : []) as OrderStatus[];

  const handleSaveComment = async () => {
    if (!order) return;
    setIsSaving(true);
    const res = await apiClient.put(`/api/v1/admin/orders/${order.id}/comment`, { comment });
    setIsSaving(false);
    if (res.success) {
      toast.success(t('noteSaved'));
      setOrder({ ...order, managerComment: comment });
    } else {
      toast.error(res.error || t('error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute right-0 top-0 flex h-full w-full flex-col bg-[var(--color-bg)] shadow-2xl sm:w-[440px]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          {order ? (
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">#{order.orderNumber}</h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: ORDER_STATUS_COLORS[order.status] }}
                >
                  {tl(`status.${order.status}`)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                {new Date(order.createdAt).toLocaleString('uk-UA')}
              </p>
            </div>
          ) : (
            <h3 className="text-sm font-medium">{t('loading')}</h3>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading || !order ? (
            <div className="flex justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Customer info */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('customer')}
                </p>
                <p className="text-sm font-medium">{order.contactName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{order.contactPhone}</p>
                {order.contactEmail && (
                  <p className="text-xs text-[var(--color-text-secondary)]">{order.contactEmail}</p>
                )}
              </div>

              {/* Items summary */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('items', { count: order.items.length })}
                </p>
                <ul className="space-y-1.5 rounded-lg bg-[var(--color-bg-secondary)]/40 p-3 text-xs">
                  {order.items.slice(0, 5).map((it) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span className="truncate">{it.productName}</span>
                      <span className="shrink-0 text-[var(--color-text-secondary)]">
                        ×{it.quantity}
                      </span>
                    </li>
                  ))}
                  {order.items.length > 5 && (
                    <li className="text-[10px] italic text-[var(--color-text-secondary)]">
                      {t('andMore', { count: order.items.length - 5 })}
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-right text-sm font-bold">
                  {Number(order.totalAmount).toFixed(2)} ₴
                </p>
              </div>

              {/* Quick status change */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('payment')}{' '}
                  <span
                    className={
                      order.paymentStatus === 'paid'
                        ? 'text-green-600'
                        : order.paymentStatus === 'pending'
                          ? 'text-amber-600'
                          : 'text-[var(--color-text-secondary)]'
                    }
                  >
                    {tl(`paymentStatus.${order.paymentStatus}`)}
                  </span>
                </label>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('changeStatus')}
                </label>
                {allowedNext.length === 0 ? (
                  <p className="text-xs italic text-[var(--color-text-secondary)]">
                    {t('noTransitions', { status: tl(`status.${order.status}`) })}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                      options={[
                        { value: '', label: t('chooseStatus') },
                        ...allowedNext.map((s) => ({ value: s, label: tl(`status.${s}`) })),
                      ]}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleStatusChange}
                      disabled={!newStatus || isSaving}
                    >
                      {t('apply')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Internal note */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('internalNote')}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onBlur={() => {
                    if (comment !== (order.managerComment || '')) handleSaveComment();
                  }}
                  rows={3}
                  placeholder={t('notePlaceholder')}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
          )}
        </div>

        {order && (
          <div className="border-t border-[var(--color-border)] p-3">
            <Link
              href={`/admin/orders/${order.id}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-bg-secondary)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-border)]"
              onClick={onClose}
            >
              {t('openFullPage')}
              <ExternalLink size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
