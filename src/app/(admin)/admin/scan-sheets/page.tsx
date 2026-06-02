'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ScanSheet {
  Ref: string;
  Number: string;
  DateTime?: string;
  Date?: string;
  Count?: string | number;
  Printed?: string;
}

export default function ScanSheetsPage() {
  const t = useTranslations('admin.scanSheetsPage');
  const [sheets, setSheets] = useState<ScanSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteRef, setDeleteRef] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    const res = await apiClient.get<ScanSheet[]>('/api/v1/admin/scan-sheets');
    if (res.success && Array.isArray(res.data)) {
      setSheets(res.data);
    } else if (!res.success) {
      toast.error(res.error || t('loadError'));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmDelete = async () => {
    if (!deleteRef) return;
    setIsDeleting(true);
    const res = await apiClient.delete('/api/v1/admin/scan-sheets', { refs: [deleteRef] });
    if (res.success) {
      toast.success(t('deleted'));
      setSheets((prev) => prev.filter((s) => s.Ref !== deleteRef));
    } else {
      toast.error(res.error || t('deleteError'));
    }
    setIsDeleting(false);
    setDeleteRef(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={isLoading}>
          {t('refresh')}
        </Button>
      </div>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">{t('subtitle')}</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : sheets.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] text-left text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-3 py-2">{t('colNumber')}</th>
                <th className="px-3 py-2">{t('colDate')}</th>
                <th className="px-3 py-2">{t('colCount')}</th>
                <th className="px-3 py-2">{t('colPrinted')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <tr key={s.Ref} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-medium">{s.Number}</td>
                  <td className="px-3 py-2">{s.DateTime || s.Date || '—'}</td>
                  <td className="px-3 py-2">{s.Count ?? '—'}</td>
                  <td className="px-3 py-2">{s.Printed === '1' ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setDeleteRef(s.Ref)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteRef}
        onClose={() => setDeleteRef(null)}
        onConfirm={confirmDelete}
        title={t('deleteConfirmTitle')}
        message={t('deleteConfirmMsg')}
        confirmText={t('delete')}
        isLoading={isDeleting}
      />
    </div>
  );
}
