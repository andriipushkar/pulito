'use client';

import { useRef } from 'react';
import type { OrderDetail } from '@/types/order';
import {
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
} from '@/types/order';
import { useSettings } from '@/hooks/useSettings';

interface PrintableOrderProps {
  order: OrderDetail;
}

export default function PrintableOrder({ order }: PrintableOrderProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const settings = useSettings();
  const COMPANY = {
    name: settings.site_name,
    tagline: settings.company_description,
    website: settings.site_email.split('@')[1] || 'poroshok.ua',
    phone: settings.site_phone_display,
    email: settings.site_email,
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8"/>
<title>Накладна #${order.orderNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; padding: 20px; }
  .doc { max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
  .header-left h1 { font-size: 22px; color: #2563eb; margin-bottom: 2px; }
  .header-left p { font-size: 10px; color: #666; }
  .header-right { text-align: right; font-size: 10px; color: #666; line-height: 1.6; }
  .title { text-align: center; margin-bottom: 16px; }
  .title h2 { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
  .title .meta { font-size: 11px; color: #666; }
  .title .status { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 10px; font-weight: bold; color: #fff; margin-left: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; }
  .box h3 { font-size: 9px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .box p { font-size: 11px; line-height: 1.6; }
  .box .label { color: #888; font-size: 10px; }
  .box .value { font-weight: 600; }
  .box .ttn { font-size: 14px; font-weight: bold; color: #2563eb; letter-spacing: 1px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  thead th { background: #f0f4ff; color: #2563eb; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 8px; text-align: left; border-bottom: 2px solid #2563eb; }
  thead th.r { text-align: right; }
  thead th.c { text-align: center; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  tbody td.r { text-align: right; }
  tbody td.c { text-align: center; }
  tbody tr:nth-child(even) { background: #fafbfc; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-box { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
  .totals-row.total { border-top: 2px solid #2563eb; padding-top: 8px; margin-top: 4px; font-size: 14px; font-weight: bold; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 16px; border-top: 1px solid #ddd; }
  .sig-block p { font-size: 11px; margin-bottom: 24px; }
  .sig-line { border-bottom: 1px solid #333; width: 100%; margin-top: 20px; }
  .sig-label { font-size: 9px; color: #888; margin-top: 2px; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #eee; text-align: center; font-size: 9px; color: #999; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    @page { margin: 15mm; }
  }
</style>
</head>
<body>
${content.innerHTML}
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    win.document.close();
  };

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const formatDateTime = (date: string | Date) =>
    new Date(date).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusColor = {
    new_order: '#3b82f6',
    processing: '#f59e0b',
    confirmed: '#10b981',
    paid: '#06b6d4',
    shipped: '#8b5cf6',
    completed: '#6b7280',
    cancelled: '#ef4444',
    returned: '#f97316',
  }[order.status] || '#666';

  return (
    <>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Друк накладної
      </button>

      {/* Hidden printable content */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={printRef}>
          <div className="doc">
            {/* Header */}
            <div className="header">
              <div className="header-left">
                <h1>{COMPANY.name}</h1>
                <p>{COMPANY.tagline}</p>
              </div>
              <div className="header-right">
                <p>{COMPANY.website}</p>
                <p>{COMPANY.phone}</p>
                <p>{COMPANY.email}</p>
              </div>
            </div>

            {/* Title */}
            <div className="title">
              <h2>
                Товарна накладна №{order.orderNumber}
                <span className="status" style={{ backgroundColor: statusColor }}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </h2>
              <p className="meta">від {formatDateTime(order.createdAt)}</p>
            </div>

            {/* Info grid */}
            <div className="grid">
              <div className="box">
                <h3>Відправник</h3>
                <p className="value">{COMPANY.name}</p>
                <p>{COMPANY.tagline}</p>
                <p><span className="label">Тел:</span> {COMPANY.phone}</p>
                <p><span className="label">Сайт:</span> {COMPANY.website}</p>
              </div>
              <div className="box">
                <h3>Отримувач</h3>
                <p className="value">{order.contactName}</p>
                <p><span className="label">Тел:</span> {order.contactPhone}</p>
                {order.contactEmail && <p><span className="label">Email:</span> {order.contactEmail}</p>}
              </div>
              <div className="box">
                <h3>Доставка</h3>
                <p className="value">{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</p>
                {order.deliveryCity && <p>{order.deliveryCity}</p>}
                {order.deliveryAddress && <p>{order.deliveryAddress}</p>}
                {order.trackingNumber && (
                  <p className="ttn">ТТН: {order.trackingNumber}</p>
                )}
              </div>
              <div className="box">
                <h3>Оплата</h3>
                <p className="value">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
                <p>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
                {order.comment && (
                  <>
                    <p style={{ marginTop: '6px' }}><span className="label">Коментар:</span></p>
                    <p>{order.comment}</p>
                  </>
                )}
              </div>
            </div>

            {/* Items table */}
            <table>
              <thead>
                <tr>
                  <th className="c" style={{ width: '30px' }}>№</th>
                  <th style={{ width: '80px' }}>Код</th>
                  <th>Найменування</th>
                  <th className="c" style={{ width: '40px' }}>Од.</th>
                  <th className="c" style={{ width: '50px' }}>К-ть</th>
                  <th className="r" style={{ width: '80px' }}>Ціна, ₴</th>
                  <th className="r" style={{ width: '90px' }}>Сума, ₴</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={item.productId}>
                    <td className="c">{i + 1}</td>
                    <td>{item.productCode}</td>
                    <td>{item.productName}</td>
                    <td className="c">шт.</td>
                    <td className="c">{item.quantity}</td>
                    <td className="r">{Number(item.priceAtOrder).toFixed(2)}</td>
                    <td className="r">{Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals">
              <div className="totals-box">
                {Number(order.discountAmount) > 0 && (
                  <div className="totals-row">
                    <span>Знижка:</span>
                    <span>-{Number(order.discountAmount).toFixed(2)} ₴</span>
                  </div>
                )}
                {Number(order.deliveryCost) > 0 && (
                  <div className="totals-row">
                    <span>Доставка:</span>
                    <span>{Number(order.deliveryCost).toFixed(2)} ₴</span>
                  </div>
                )}
                <div className="totals-row total">
                  <span>Разом:</span>
                  <span>{Number(order.totalAmount).toFixed(2)} ₴</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="signatures">
              <div className="sig-block">
                <p>Відпустив:</p>
                <div className="sig-line" />
                <p className="sig-label">підпис / ПІБ</p>
              </div>
              <div className="sig-block">
                <p>Отримав:</p>
                <div className="sig-line" />
                <p className="sig-label">підпис / ПІБ</p>
              </div>
            </div>

            {/* Footer */}
            <div className="footer">
              <p>© {new Date().getFullYear()} {COMPANY.name} • {COMPANY.website} • {COMPANY.phone}</p>
              <p>Документ сформовано: {formatDateTime(new Date())}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
