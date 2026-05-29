'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface FeatureFlag {
  id: number;
  key: string;
  description: string | null;
  isEnabled: boolean;
  rolloutPercent: number;
  targetRoles: string[];
  targetUserIds: number[];
  createdAt: string;
  updatedAt: string;
}

export default function AdminFeatureFlagsPage() {
  const t = useTranslations('admin.adminFeatureFlagsPage');
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    key: '',
    description: '',
    isEnabled: false,
    rolloutPercent: 100,
    targetRoles: '',
    targetUserIds: '',
  });
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editRollout, setEditRollout] = useState(100);
  const [editRoles, setEditRoles] = useState('');
  const [editUserIds, setEditUserIds] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const loadFlags = () => {
    apiClient
      .get<FeatureFlag[]>('/api/v1/admin/feature-flags')
      .then((res) => {
        if (res.success && res.data) setFlags(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleCreate = async () => {
    if (!form.key) {
      toast.error(t('validateKey'));
      return;
    }

    const res = await apiClient.post('/api/v1/admin/feature-flags', {
      key: form.key,
      description: form.description || null,
      isEnabled: form.isEnabled,
      rolloutPercent: form.rolloutPercent,
      targetRoles: form.targetRoles ? form.targetRoles.split(',').map((r) => r.trim()) : [],
      targetUserIds: form.targetUserIds
        ? form.targetUserIds
            .split(',')
            .map((id) => Number(id.trim()))
            .filter(Boolean)
        : [],
    });

    if (res.success) {
      toast.success(t('createdToast'));
      setShowForm(false);
      setForm({
        key: '',
        description: '',
        isEnabled: false,
        rolloutPercent: 100,
        targetRoles: '',
        targetUserIds: '',
      });
      loadFlags();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  // Flags whose key matches one of these patterns are treated as
  // critical — flipping them off mid-day can drop entire revenue paths
  // (payment, checkout, marketplace publishing). Require an explicit
  // confirm so a stray click doesn't take prod offline.
  const CRITICAL_FLAG_PATTERNS = /^(payment|checkout|cart|order|marketplace|sync|auth|wholesale)/i;

  const toggleFlag = async (flag: FeatureFlag) => {
    const turningOff = flag.isEnabled;
    const isCritical = CRITICAL_FLAG_PATTERNS.test(flag.key);
    if (turningOff && isCritical) {
      const ok = window.confirm(t('criticalConfirm', { key: flag.key }));
      if (!ok) return;
    }
    const res = await apiClient.patch(`/api/v1/admin/feature-flags/${flag.key}`, {
      isEnabled: !flag.isEnabled,
      // Optimistic-lock token: include current value so the server can
      // detect a concurrent edit (another admin flipped the flag while we
      // were holding the page). updatedAt is the natural version.
      expectedUpdatedAt: flag.updatedAt,
    });
    if (res.success) {
      toast.success(flag.isEnabled ? t('disabledToast') : t('enabledToast'));
      loadFlags();
    } else if (res.statusCode === 409) {
      toast.error(t('conflictToast'));
      loadFlags();
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  const startEdit = (flag: FeatureFlag) => {
    setEditingKey(flag.key);
    setEditRollout(flag.rolloutPercent);
    setEditRoles(flag.targetRoles.join(', '));
    setEditUserIds(flag.targetUserIds.join(', '));
    setEditDescription(flag.description || '');
  };

  const saveEdit = async (key: string) => {
    const res = await apiClient.patch(`/api/v1/admin/feature-flags/${key}`, {
      rolloutPercent: editRollout,
      description: editDescription || null,
      targetRoles: editRoles ? editRoles.split(',').map((r) => r.trim()) : [],
      targetUserIds: editUserIds
        ? editUserIds
            .split(',')
            .map((id) => Number(id.trim()))
            .filter(Boolean)
        : [],
      // Optimistic-lock token: same as toggleFlag, so a concurrent edit to
      // rollout/roles/userIds is rejected instead of silently clobbering.
      expectedUpdatedAt: flags.find((f) => f.key === key)?.updatedAt,
    });
    if (res.success) {
      toast.success(t('updatedToast'));
    } else if (res.statusCode === 409) {
      toast.error(t('conflictToast'));
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
    setEditingKey(null);
    loadFlags();
  };

  const executeDelete = async () => {
    if (!deleteKey) return;
    const key = deleteKey;
    setDeleteKey(null);
    const res = await apiClient.delete(`/api/v1/admin/feature-flags/${key}`);
    if (res.success) toast.success(t('deletedToast'));
    else toast.error(t('deleteError'));
    loadFlags();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={4} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : t('addBtn')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t('keyLabel')}
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder={t('keyPh')}
            />
            <Input
              label={t('descLabel')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descPh')}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t('rolloutLabel', { percent: form.rolloutPercent })}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.rolloutPercent}
                onChange={(e) => setForm({ ...form, rolloutPercent: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <Input
              label={t('rolesLabel')}
              value={form.targetRoles}
              onChange={(e) => setForm({ ...form, targetRoles: e.target.value })}
              placeholder={t('rolesPh')}
            />
            <Input
              label={t('userIdsLabel')}
              value={form.targetUserIds}
              onChange={(e) => setForm({ ...form, targetUserIds: e.target.value })}
              placeholder={t('userIdsPh')}
            />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
              />
              {t('enabled')}
            </label>
            <div className="flex-1" />
            <Button onClick={handleCreate}>{t('create')}</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
          >
            {editingKey === flag.key ? (
              <div className="space-y-3">
                <Input
                  label={t('descLabel')}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {t('rolloutLabel', { percent: editRollout })}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={editRollout}
                      onChange={(e) => setEditRollout(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <Input
                    label={t('editLabelRoles')}
                    value={editRoles}
                    onChange={(e) => setEditRoles(e.target.value)}
                  />
                  <Input
                    label={t('editLabelUserIds')}
                    value={editUserIds}
                    onChange={(e) => setEditUserIds(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setEditingKey(null)}>{t('cancel')}</Button>
                  <Button onClick={() => saveEdit(flag.key)}>{t('save')}</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggleFlag(flag)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${flag.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {flag.isEnabled ? 'ON' : 'OFF'}
                </button>
                <code className="text-sm font-mono">{flag.key}</code>
                <span className="flex-1 text-sm text-[var(--color-text-secondary)]">
                  {flag.description || '—'}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {flag.rolloutPercent}%
                </span>
                {flag.targetRoles.length > 0 && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t('rolesPrefix')} {flag.targetRoles.join(', ')}
                  </span>
                )}
                <button
                  onClick={() => startEdit(flag)}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                >
                  {t('edit')}
                </button>
                <button
                  onClick={() => setDeleteKey(flag.key)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {t('delete')}
                </button>
              </div>
            )}
          </div>
        ))}
        {flags.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">{t('empty')}</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteKey !== null}
        onClose={() => setDeleteKey(null)}
        onConfirm={executeDelete}
        variant="danger"
        message={t('deleteMsg')}
      />
    </div>
  );
}
