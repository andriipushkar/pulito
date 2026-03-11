'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/types/order';
import type { OrderDetail, OrderStatus } from '@/types/order';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import OrderItemsEditor from '@/components/admin/OrderItemsEditor';
import CreateTTNForm from '@/components/admin/CreateTTNForm';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new_order: ['processing', 'cancelled'],
  processing: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'shipped', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed', 'returned'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
};

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [comment, setComment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [sendPhotoItem, setSendPhotoItem] = useState<{
    productId: number;
    productName: string;
  } | null>(null);
  const [sendPhotoMessage, setSendPhotoMessage] = useState('');
  const [isSendingPhoto, setIsSendingPhoto] = useState(false);
  const [sendPhotoResult, setSendPhotoResult] = useState('');
  const [managerComment, setManagerComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [managers, setManagers] = useState<{ id: number; fullName: string }[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>('');

  // TTN state
  const [ttnInput, setTtnInput] = useState('');
  const [isSavingTtn, setIsSavingTtn] = useState(false);
  const [isEditingTtn, setIsEditingTtn] = useState(false);
  const [showCreateTtnForm, setShowCreateTtnForm] = useState(false);

  useEffect(() => {
    apiClient
      .get<OrderDetail>(`/api/v1/admin/orders/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setOrder(res.data);
          setManagerComment(res.data.managerComment || '');
          setTtnInput(res.data.trackingNumber || '');
          setSelectedManager(String(res.data.assignedManagerId || ''));
        }
      })
      .finally(() => setIsLoading(false));
    // Load managers list
    apiClient.get<{ id: number; fullName: string }[]>('/api/v1/admin/users?role=manager&role2=admin&limit=50').then((res) => {
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : [];
        setManagers(list.filter((u: { role?: string }) => u.role === 'admin' || u.role === 'manager'));
      }
    });
  }, [id]);

  const reloadOrder = async () => {
    const updated = await apiClient.get<OrderDetail>(`/api/v1/admin/orders/${id}`);
    if (updated.success && updated.data) {
      setOrder(updated.data);
      setManagerComment(updated.data.managerComment || '');
      setTtnInput(updated.data.trackingNumber || '');
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    setIsUpdating(true);
    setError('');
    try {
      const res = await apiClient.put(`/api/v1/admin/orders/${id}/status`, {
        status: newStatus,
        comment: comment || undefined,
      });
      if (res.success) {
        await reloadOrder();
        setNewStatus('');
        setComment('');
      } else {
        setError(res.error || 'Помилка оновлення');
      }
    } catch {
      setError('Помилка мережі');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveComment = async () => {
    setIsSavingComment(true);
    const res = await apiClient.put(`/api/v1/admin/orders/${id}/comment`, {
      comment: managerComment,
    });
    if (res.success) {
      setActionResult({ type: 'success', text: 'Коментар збережено' });
    } else {
      setActionResult({ type: 'error', text: res.error || 'Помилка' });
    }
    setIsSavingComment(false);
    setTimeout(() => setActionResult(null), 3000);
  };

  const handleSaveTtn = async () => {
    if (!ttnInput.trim()) return;
    setIsSavingTtn(true);
    const res = await apiClient.put(`/api/v1/admin/orders/${id}/ttn`, {
      trackingNumber: ttnInput.trim(),
    });
    if (res.success) {
      setActionResult({ type: 'success', text: 'ТТН збережено' });
      setIsEditingTtn(false);
      await reloadOrder();
    } else {
      setActionResult({ type: 'error', text: res.error || 'Помилка збереження ТТН' });
    }
    setIsSavingTtn(false);
    setTimeout(() => setActionResult(null), 3000);
  };

  const handleCreateInvoice = async () => {
    setActionResult(null);
    const res = await apiClient.post(`/api/v1/admin/orders/${id}/invoice`, {});
    if (res.success) {
      const data = res.data as { invoicePdfUrl: string };
      window.open(data.invoicePdfUrl, '_blank');
    } else {
      setActionResult({ type: 'error', text: res.error || 'Помилка створення рахунку' });
    }
  };

  const handleCreateDeliveryNote = async () => {
    setActionResult(null);
    const res = await apiClient.post(`/api/v1/admin/orders/${id}/delivery-note`, {});
    if (res.success) {
      const data = res.data as { pdfUrl: string };
      window.open(data.pdfUrl, '_blank');
    } else {
      setActionResult({ type: 'error', text: res.error || 'Помилка створення накладної' });
    }
  };

  const handleSendPhoto = async () => {
    if (!sendPhotoItem) return;
    setIsSendingPhoto(true);
    setSendPhotoResult('');
    try {
      const res = await apiClient.post(`/api/v1/admin/orders/${id}/send-product-photo`, {
        productId: sendPhotoItem.productId,
        message: sendPhotoMessage || undefined,
      });
      if (res.success) {
        const data = res.data as { channels: string };
        setSendPhotoResult(`Фото відправлено (${data.channels})`);
        setTimeout(() => {
          setSendPhotoItem(null);
          setSendPhotoMessage('');
          setSendPhotoResult('');
        }, 2000);
      } else {
        setSendPhotoResult(res.error || 'Помилка відправки');
      }
    } catch {
      setSendPhotoResult('Помилка мережі');
    } finally {
      setIsSendingPhoto(false);
    }
  };

  const formatDateTime = (d: string | Date) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">Замовлення не знайдено</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/orders')}>
          До списку
        </Button>
      </div>
    );
  }

  const allowedStatuses = ALLOWED_TRANSITIONS[order.status] || [];
  const orderTotal = Number(order.totalAmount);
  const deliveryCost = Number(order.deliveryCost || 0);
  const discount = Number(order.discountAmount || 0);
  const itemsSubtotal = order.items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm text-[var(--color-primary)] hover:underline">
            &larr; Замовлення
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="text-xl font-bold">#{order.orderNumber}</h2>
            <span
              className="rounded-full px-3 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: ORDER_STATUS_COLORS[order.status] }}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            {order.clientType === 'wholesale' && (
              <span className="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]">
                ОПТ
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {formatDateTime(order.createdAt)}
            {order.source !== 'web' && (
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase">
                {order.source === 'telegram_bot' ? 'Telegram' : 'Viber'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCreateInvoice}>
            Рахунок
          </Button>
          <Button size="sm" variant="outline" onClick={handleCreateDeliveryNote}>
            Видаткова
          </Button>
        </div>
      </div>

      {actionResult && (
        <div
          className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${
            actionResult.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-[var(--color-danger)]'
          }`}
        >
          {actionResult.text}
        </div>
      )}

      {/* Status update */}
      {allowedStatuses.length > 0 && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Змінити статус</h3>
          <div className="flex flex-wrap gap-3">
            <Select
              options={[
                { value: '', label: 'Оберіть статус' },
                ...allowedStatuses.map((s) => ({
                  value: s,
                  label: ORDER_STATUS_LABELS[s as OrderStatus],
                })),
              ]}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="Коментар (необов&#39;язково)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleStatusUpdate} isLoading={isUpdating} disabled={!newStatus}>
              Оновити
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
        </div>
      )}

      {/* Manager assignment */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Відповідальний менеджер</h3>
        <div className="flex items-center gap-3">
          <Select
            options={[
              { value: '', label: 'Не призначено' },
              ...managers.map((m) => ({ value: String(m.id), label: m.fullName })),
            ]}
            value={selectedManager}
            onChange={async (e) => {
              const val = e.target.value;
              setSelectedManager(val);
              const res = await apiClient.put(`/api/v1/admin/orders/${id}`, {
                assignedManagerId: val ? Number(val) : null,
              });
              if (res.success) {
                setActionResult({ type: 'success', text: val ? 'Менеджера призначено' : 'Менеджера знято' });
              } else {
                setActionResult({ type: 'error', text: res.error || 'Помилка' });
              }
              setTimeout(() => setActionResult(null), 3000);
            }}
            className="w-64"
          />
          {selectedManager && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              ID: {selectedManager}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Client */}
        <InfoCard title="Клієнт">
          <p className="font-medium">{order.contactName}</p>
          <p>{order.contactPhone}</p>
          <p>{order.contactEmail}</p>
          {order.user && (
            <Link
              href={`/admin/users/${order.user.id}`}
              className="mt-2 inline-block text-xs text-[var(--color-primary)] hover:underline"
            >
              Профіль клієнта &rarr;
            </Link>
          )}
        </InfoCard>

        {/* Delivery + TTN */}
        <InfoCard title="Доставка">
          <p className="font-medium">{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</p>
          {order.deliveryCity && <p>{order.deliveryCity}</p>}
          {order.deliveryAddress && <p>{order.deliveryAddress}</p>}

          {/* TTN Section */}
          {order.trackingNumber && !isEditingTtn ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <p className="rounded bg-violet-50 px-2 py-1 text-sm font-semibold text-violet-700">
                  TTH: {order.trackingNumber}
                </p>
                <button
                  onClick={() => setIsEditingTtn(true)}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline"
                >
                  Змінити
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <p className="mb-1 text-xs text-[var(--color-text-secondary)]">
                {order.trackingNumber ? 'Змінити ТТН:' : 'Додати ТТН:'}
              </p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={ttnInput}
                  onChange={(e) => setTtnInput(e.target.value)}
                  placeholder="20450000000000"
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
                />
                <Button size="sm" onClick={handleSaveTtn} isLoading={isSavingTtn} disabled={!ttnInput.trim()}>
                  OK
                </Button>
                {isEditingTtn && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingTtn(false);
                      setTtnInput(order.trackingNumber || '');
                    }}
                  >
                    X
                  </Button>
                )}
              </div>
              {!order.trackingNumber && order.deliveryMethod === 'nova_poshta' && (
                <button
                  onClick={() => setShowCreateTtnForm(true)}
                  className="mt-1.5 text-xs text-[var(--color-primary)] hover:underline"
                >
                  Або створити через API Нової Пошти
                </button>
              )}
            </div>
          )}
        </InfoCard>

        {/* Payment */}
        <InfoCard title="Оплата">
          <p className="font-medium">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
          <p
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              order.paymentStatus === 'paid'
                ? 'bg-green-100 text-green-700'
                : order.paymentStatus === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </p>
          {order.payment?.paymentProvider && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              {order.payment.paymentProvider === 'monobank' ? 'Monobank' : 'LiqPay'}
              {order.payment.paidAt && (
                <span className="ml-1">
                  ({new Date(order.payment.paidAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </p>
          )}
          {order.payment?.receiptUrl && (
            <a
              href={order.payment.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Електронний чек
            </a>
          )}
          <div className="mt-2 space-y-0.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Товари:</span>
              <span>{itemsSubtotal.toFixed(2)} &#8372;</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Знижка:</span>
                <span className="text-green-600">-{discount.toFixed(2)} &#8372;</span>
              </div>
            )}
            {deliveryCost > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Доставка:</span>
                <span>{deliveryCost.toFixed(2)} &#8372;</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-bold">
              <span>Всього:</span>
              <span>{orderTotal.toFixed(2)} &#8372;</span>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Customer comment */}
      {order.comment && (
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            Коментар покупця
          </p>
          <p className="text-sm">{order.comment}</p>
        </div>
      )}

      {/* Manager comment */}
      <div className="mt-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
          Нотатка менеджера
        </p>
        <div className="flex gap-2">
          <textarea
            value={managerComment}
            onChange={(e) => setManagerComment(e.target.value)}
            placeholder="Внутрішній коментар (видно тільки менеджерам)..."
            rows={2}
            className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveComment}
            isLoading={isSavingComment}
          >
            Зберегти
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="mt-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold">Товари ({order.items.length})</h3>
          {['new_order', 'processing', 'confirmed'].includes(order.status) && (
            <Button size="sm" variant="outline" onClick={() => setIsEditingItems(true)}>
              Редагувати
            </Button>
          )}
        </div>
        {order.items.map((item, i) => (
          <div
            key={item.productId}
            className={`flex gap-3 px-4 py-3 ${
              i < order.items.length - 1 ? 'border-b border-[var(--color-border)]' : ''
            }`}
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
              {item.imagePath ? (
                <Image
                  src={item.imagePath}
                  alt={item.productName}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-[var(--color-text-secondary)]">
                  Фото
                </div>
              )}
            </div>
            <div className="flex flex-1 items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {item.productCode}
                  {item.isPromo && (
                    <span className="ml-1.5 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-medium text-orange-600">
                      Акція
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  {Number(item.priceAtOrder).toFixed(2)} &times; {item.quantity}
                </span>
                <span className="min-w-[80px] font-bold">
                  {Number(item.subtotal).toFixed(2)} &#8372;
                </span>
                <button
                  type="button"
                  title="Надіслати фото клієнту"
                  onClick={() => {
                    setSendPhotoItem({
                      productId: item.productId,
                      productName: item.productName,
                    });
                    setSendPhotoMessage('');
                    setSendPhotoResult('');
                  }}
                  className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status history */}
      {order.statusHistory.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-secondary)]">
            Історія змін
          </h3>
          <div className="space-y-2">
            {order.statusHistory.map((h) => (
              <div key={h.id} className="flex items-start gap-2 text-sm">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                <div>
                  <span>
                    {h.oldStatus
                      ? `${ORDER_STATUS_LABELS[h.oldStatus as OrderStatus]} \u2192 ${ORDER_STATUS_LABELS[h.newStatus as OrderStatus]}`
                      : ORDER_STATUS_LABELS[h.newStatus as OrderStatus]}
                  </span>
                  <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                    {formatDateTime(h.createdAt)}
                  </span>
                  <span className="ml-1 text-[10px] text-[var(--color-text-secondary)]">
                    ({h.changeSource === 'manager' ? 'менеджер' : h.changeSource === 'client_action' ? 'клієнт' : h.changeSource})
                  </span>
                  {h.comment && (
                    <p className="text-xs italic text-[var(--color-text-secondary)]">{h.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit items modal */}
      <Modal
        isOpen={isEditingItems}
        onClose={() => setIsEditingItems(false)}
        title="Редагувати товари"
        size="lg"
      >
        <OrderItemsEditor
          orderId={order.id}
          items={order.items}
          onSaved={(updatedOrder) => {
            setOrder(updatedOrder);
            setIsEditingItems(false);
          }}
          onClose={() => setIsEditingItems(false)}
        />
      </Modal>

      {/* Create TTN via Nova Poshta modal */}
      <Modal
        isOpen={showCreateTtnForm}
        onClose={() => setShowCreateTtnForm(false)}
        title="Створити ТТН через Нову Пошту"
        size="lg"
      >
        <CreateTTNForm
          orderId={order.id}
          recipientName={order.contactName}
          recipientPhone={order.contactPhone}
          recipientCity={order.deliveryCity}
          recipientWarehouseRef={order.deliveryWarehouseRef}
          orderAmount={orderTotal}
          onCreated={async (trackingNumber) => {
            setShowCreateTtnForm(false);
            setActionResult({ type: 'success', text: `ТТН створено: ${trackingNumber}` });
            await reloadOrder();
            setTimeout(() => setActionResult(null), 5000);
          }}
          onCancel={() => setShowCreateTtnForm(false)}
        />
      </Modal>

      {/* Send photo modal */}
      <Modal
        isOpen={!!sendPhotoItem}
        onClose={() => setSendPhotoItem(null)}
        title="Надіслати фото клієнту"
      >
        {sendPhotoItem && (
          <div className="space-y-4">
            <p className="text-sm">
              Надіслати фото <b>{sendPhotoItem.productName}</b> клієнту через Telegram/Viber?
            </p>
            <Input
              placeholder="Повідомлення (необов'язково)"
              value={sendPhotoMessage}
              onChange={(e) => setSendPhotoMessage(e.target.value)}
            />
            {sendPhotoResult && (
              <p
                className={`text-sm ${
                  sendPhotoResult.startsWith('Фото')
                    ? 'text-green-600'
                    : 'text-[var(--color-danger)]'
                }`}
              >
                {sendPhotoResult}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSendPhotoItem(null)}>
                Скасувати
              </Button>
              <Button onClick={handleSendPhoto} isLoading={isSendingPhoto}>
                Надіслати
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
        {title}
      </p>
      <div className="space-y-0.5 text-sm">{children}</div>
    </div>
  );
}
