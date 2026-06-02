'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import WarehousePicker from '@/components/admin/WarehousePicker';

interface TTNActionsProps {
  orderId: number;
  /** Called after an action that changes the order (e.g. cancel) so the page can reload. */
  onChanged: () => void;
}

type PrintType = 'document' | 'marking100x100';
interface NpReason {
  Ref: string;
  Description: string;
}

/**
 * Action bar for an order that already has a Nova Poshta TTN: print the A4
 * waybill / 100×100 sticker, cancel the TTN, redirect the parcel to another
 * warehouse, or create a return. Printing streams the PDF through the
 * authenticated API (the print URL embeds the apiKey server-side).
 */
export default function TTNActions({ orderId, onChanged }: TTNActionsProps) {
  const t = useTranslations('admin.ttnActions');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Redirect modal
  const [redirectOpen, setRedirectOpen] = useState(false);
  const [redirectWh, setRedirectWh] = useState('');

  // Return modal
  const [returnOpen, setReturnOpen] = useState(false);
  const [reasons, setReasons] = useState<NpReason[]>([]);
  const [subtypes, setSubtypes] = useState<NpReason[]>([]);
  const [reasonRef, setReasonRef] = useState('');
  const [subtypeRef, setSubtypeRef] = useState('');
  const [returnAddressRef, setReturnAddressRef] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);

  const print = async (type: PrintType) => {
    setBusy(type);
    try {
      const blob = await apiClient.download(
        `/api/v1/admin/orders/${orderId}/ttn/print?type=${type}`,
      );
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('printError'));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setConfirmCancel(false);
    setBusy('cancel');
    const res = await apiClient.delete(`/api/v1/admin/orders/${orderId}/ttn`);
    if (res.success) {
      toast.success(t('cancelled'));
      onChanged();
    } else {
      toast.error(res.error || t('cancelError'));
    }
    setBusy(null);
  };

  const submitRedirect = async () => {
    if (!redirectWh) {
      toast.error(t('selectWarehouse'));
      return;
    }
    setBusy('redirect');
    const res = await apiClient.post<{ number: string }>(
      `/api/v1/admin/orders/${orderId}/redirect`,
      { recipientWarehouseRef: redirectWh },
    );
    if (res.success) {
      toast.success(t('redirectDone', { n: res.data?.number || '' }));
      setRedirectOpen(false);
      setRedirectWh('');
    } else {
      toast.error(res.error || t('redirectError'));
    }
    setBusy(null);
  };

  const openReturn = async () => {
    setReturnOpen(true);
    setReturnLoading(true);
    setReasons([]);
    setSubtypes([]);
    setReasonRef('');
    setSubtypeRef('');
    const res = await apiClient.get<{ reasons: NpReason[] }>(
      `/api/v1/admin/orders/${orderId}/return`,
    );
    if (res.success && res.data) {
      setReasons(Array.isArray(res.data.reasons) ? res.data.reasons : []);
    } else {
      toast.error(res.error || t('returnError'));
    }
    setReturnLoading(false);
  };

  const onReasonChange = async (ref: string) => {
    setReasonRef(ref);
    setSubtypeRef('');
    setSubtypes([]);
    if (!ref) return;
    const res = await apiClient.get<{ subtypes: NpReason[] }>(
      `/api/v1/admin/orders/${orderId}/return?reasonRef=${encodeURIComponent(ref)}`,
    );
    if (res.success && res.data) {
      setSubtypes(Array.isArray(res.data.subtypes) ? res.data.subtypes : []);
    }
  };

  const submitReturn = async () => {
    if (!reasonRef || !subtypeRef || !returnAddressRef.trim()) {
      toast.error(t('selectReason'));
      return;
    }
    setBusy('return');
    const res = await apiClient.post<{ number: string }>(`/api/v1/admin/orders/${orderId}/return`, {
      reasonRef,
      subtypeReasonRef: subtypeRef,
      returnAddressRef: returnAddressRef.trim(),
    });
    if (res.success) {
      toast.success(t('returnDone', { n: res.data?.number || '' }));
      setReturnOpen(false);
    } else {
      toast.error(res.error || t('returnError'));
    }
    setBusy(null);
  };

  const selectCls =
    'w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm';

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={() => print('document')}
        isLoading={busy === 'document'}
      >
        🖨 {t('printTtn')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => print('marking100x100')}
        isLoading={busy === 'marking100x100'}
      >
        🏷 {t('printSticker')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setRedirectOpen(true)}>
        ↪ {t('redirect')}
      </Button>
      <Button size="sm" variant="outline" onClick={openReturn}>
        ↩ {t('ret')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setConfirmCancel(true)}
        isLoading={busy === 'cancel'}
      >
        ✕ {t('cancelTtn')}
      </Button>

      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        title={t('cancelTitle')}
        message={t('cancelConfirm')}
        confirmText={t('cancelTtn')}
      />

      {/* Redirect to another warehouse */}
      <Modal
        isOpen={redirectOpen}
        onClose={() => setRedirectOpen(false)}
        title={t('redirectTitle')}
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)]">{t('redirectTo')}</p>
          <WarehousePicker onSelect={(ref) => setRedirectWh(ref)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRedirectOpen(false)}>
              {t('cancelTtn')}
            </Button>
            <Button onClick={submitRedirect} isLoading={busy === 'redirect'} disabled={!redirectWh}>
              {t('redirectSubmit')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create a return */}
      <Modal isOpen={returnOpen} onClose={() => setReturnOpen(false)} title={t('returnTitle')}>
        {returnLoading ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">
            {t('loading')}
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">{t('reason')}</label>
              <select
                value={reasonRef}
                onChange={(e) => onReasonChange(e.target.value)}
                className={selectCls}
              >
                <option value="">—</option>
                {reasons.map((r) => (
                  <option key={r.Ref} value={r.Ref}>
                    {r.Description}
                  </option>
                ))}
              </select>
            </div>
            {subtypes.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium">{t('subtype')}</label>
                <select
                  value={subtypeRef}
                  onChange={(e) => setSubtypeRef(e.target.value)}
                  className={selectCls}
                >
                  <option value="">—</option>
                  {subtypes.map((s) => (
                    <option key={s.Ref} value={s.Ref}>
                      {s.Description}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium">{t('returnAddress')}</label>
              <input
                value={returnAddressRef}
                onChange={(e) => setReturnAddressRef(e.target.value)}
                placeholder="UUID"
                className={selectCls}
              />
              <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                {t('returnAddressHint')}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReturnOpen(false)}>
                {t('cancelTtn')}
              </Button>
              <Button onClick={submitReturn} isLoading={busy === 'return'}>
                {t('returnSubmit')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
