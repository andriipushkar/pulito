'use client';

import { useEffect, useState } from 'react';
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
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [syncs, setSyncs] = useState<SyncRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  async function fetchData() {
    try {
      const [keysRes, syncsRes] = await Promise.all([
        apiClient.get<ApiKeyRow[]>('/api/v1/admin/integration/api-keys'),
        apiClient.get<SyncRow[]>('/api/v1/admin/integration/syncs'),
      ]);

      setApiKeys(keysRes.data ?? []);
      setSyncs(syncsRes.data ?? []);
    } catch {
      // silently handle — page will show empty state
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const res = await apiClient.post<{ rawKey?: string }>('/api/v1/admin/integration/api-keys', {
        name: newKeyName.trim(),
        permissions: { products: true, orders: true, stock: true, prices: true },
      });

      if (res.data?.rawKey) {
        setCreatedKey(res.data.rawKey);
      }
      setNewKeyName('');
      fetchData();
    } catch {
      // handle error
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function handleDeactivateKey(id: number) {
    try {
      await apiClient.patch(`/api/v1/admin/integration/api-keys/${id}`, { isActive: false });
      fetchData();
    } catch {
      // handle error
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
      <h1 className="text-2xl font-bold">1C / BAS Integration</h1>

      {/* API Key Management */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">API Keys</h2>

        {createdKey && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4">
            <p className="mb-1 font-medium text-green-800">
              New API key created. Copy it now — it will not be shown again:
            </p>
            <code className="break-all text-sm">{createdKey}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
                setCreatedKey(null);
              }}
              className="ml-3 text-sm text-green-700 underline"
            >
              Copy & dismiss
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Key name (e.g. 1C Production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <Button onClick={handleCreateKey} disabled={isCreatingKey || !newKeyName.trim()}>
            {isCreatingKey ? 'Creating...' : 'Create API Key'}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last Used</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    No API keys yet
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
                      {key.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-3 py-2">{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {key.isActive && (
                      <button
                        onClick={() => handleDeactivateKey(key.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Deactivate
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
        <h2 className="text-lg font-semibold">Sync History</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Completed</th>
              </tr>
            </thead>
            <tbody>
              {syncs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                    No sync history yet
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
                      <span className="ml-1 text-red-600">({sync.itemsFailed} failed)</span>
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
    </div>
  );
}
