'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface ApiKeyRow {
  id: number;
  name: string;
  prefix: string;
  isActive: boolean;
  permissions: Record<string, boolean>;
  lastUsedAt: string | null;
  createdAt: string;
}

interface SyncRow {
  id: number;
  type: string;
  direction: string;
  entityType: string;
  status: string;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  errorLog?: unknown;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export default function AdminIntegrationsPage() {
  const t = useTranslations('admin.adminIntegrationsPage');
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [syncs, setSyncs] = useState<SyncRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  // Modal to show detailed errorLog of a failed sync. Without it the admin
  // sees "(N failed)" but no way to see WHICH items / WHY — silent failure.
  const [errorModal, setErrorModal] = useState<SyncRow | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [keysRes, syncsRes] = await Promise.all([
        apiClient.get<ApiKeyRow[]>('/api/v1/admin/integration/api-keys'),
        apiClient.get<SyncRow[]>('/api/v1/admin/integration/syncs'),
      ]);

      if (keysRes.success) setApiKeys(keysRes.data ?? []);
      else toast.error(keysRes.error || t('loadKeysError'));
      if (syncsRes.success) setSyncs(syncsRes.data ?? []);
      else toast.error(syncsRes.error || t('loadSyncsError'));
    } catch {
      toast.error(t('loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const res = await apiClient.post<{ rawKey?: string }>('/api/v1/admin/integration/api-keys', {
        name: newKeyName.trim(),
        permissions: { products: true, orders: true, stock: true, prices: true },
      });

      if (res.success && res.data?.rawKey) {
        setCreatedKey(res.data.rawKey);
        setNewKeyName('');
        fetchData();
      } else {
        toast.error(res.error || t('createKeyError'));
      }
    } catch {
      toast.error(t('createKeyError'));
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function handleDeactivateKey(id: number, name?: string) {
    const ok = window.confirm(t('deactivateConfirm', { name: name ? `«${name}»` : '' }));
    if (!ok) return;
    try {
      const res = await apiClient.patch(`/api/v1/admin/integration/api-keys/${id}`, {
        isActive: false,
      });
      if (res.success) fetchData();
      else toast.error(res.error || t('deactivateError'));
    } catch {
      toast.error(t('deactivateError'));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* API Key Management */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('apiKeysTitle')}</h2>

        {createdKey && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4">
            <p className="mb-1 font-medium text-green-800">{t('newKeyAlert')}</p>
            <code className="break-all text-sm">{createdKey}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
                toast.success(t('keyCopied'));
                setCreatedKey(null);
              }}
              className="ml-3 text-sm text-green-700 underline"
            >
              {t('copyDismiss')}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('keyNamePh')}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <Button onClick={handleCreateKey} disabled={isCreatingKey || !newKeyName.trim()}>
            {isCreatingKey ? t('creating') : t('createKey')}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2">{t('colName')}</th>
                <th className="px-3 py-2">{t('colPrefix')}</th>
                <th className="px-3 py-2">{t('colStatus')}</th>
                <th className="px-3 py-2">{t('colLastUsed')}</th>
                <th className="px-3 py-2">{t('colCreated')}</th>
                <th className="px-3 py-2">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    {t('noKeys')}
                  </td>
                </tr>
              )}
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b">
                  <td className="px-3 py-2">{key.name}</td>
                  <td className="px-3 py-2">
                    <code>{key.prefix}...</code>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        key.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {key.isActive ? t('statusActive') : t('statusInactive')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleString()
                      : t('lastUsedNever')}
                  </td>
                  <td className="px-3 py-2">{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {key.isActive && (
                      <button
                        onClick={() => handleDeactivateKey(key.id, key.name)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        {t('deactivate')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sync History */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('syncTitle')}</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2">{t('colId')}</th>
                <th className="px-3 py-2">{t('colType')}</th>
                <th className="px-3 py-2">{t('colDirection')}</th>
                <th className="px-3 py-2">{t('colEntity')}</th>
                <th className="px-3 py-2">{t('colStatus')}</th>
                <th className="px-3 py-2">{t('colProgress')}</th>
                <th className="px-3 py-2">{t('colStarted')}</th>
                <th className="px-3 py-2">{t('colCompleted')}</th>
              </tr>
            </thead>
            <tbody>
              {syncs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                    {t('noSyncs')}
                  </td>
                </tr>
              )}
              {syncs.map((sync) => (
                <tr key={sync.id} className="border-b">
                  <td className="px-3 py-2">{sync.id}</td>
                  <td className="px-3 py-2 uppercase">{sync.type.replace('_', '/')}</td>
                  <td className="px-3 py-2 capitalize">{sync.direction.replace('_sync', '')}</td>
                  <td className="px-3 py-2 capitalize">{sync.entityType}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[sync.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sync.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {sync.itemsProcessed}/{sync.itemsTotal}
                    {sync.itemsFailed > 0 && (
                      <button
                        onClick={() => setErrorModal(sync)}
                        className="ml-1 cursor-pointer text-red-600 underline hover:text-red-700"
                        title={t('failedHint')}
                      >
                        {t('failedSuffix', { count: sync.itemsFailed })}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {sync.startedAt ? new Date(sync.startedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {sync.completedAt ? new Date(sync.completedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {errorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setErrorModal(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">
                {t('errorModalTitle', { id: errorModal.id, count: errorModal.itemsFailed })}
              </h3>
              <button
                onClick={() => setErrorModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {errorModal.errorLog ? (
              <pre className="max-h-[60vh] overflow-auto rounded border border-red-200 bg-red-50 p-3 text-xs">
                {typeof errorModal.errorLog === 'string'
                  ? errorModal.errorLog
                  : JSON.stringify(errorModal.errorLog, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-gray-500">{t('errorLogEmpty')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
