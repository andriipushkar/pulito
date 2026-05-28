'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import { Check, Close } from '@/components/icons';

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  primaryColor: string | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number };
}

interface CreateForm {
  name: string;
  slug: string;
  domain: string;
  plan: string;
  primaryColor: string;
}

interface EditForm {
  name: string;
  slug: string;
  domain: string;
  plan: string;
  primaryColor: string;
  isActive: boolean;
}

export default function AdminTenantsPage() {
  const t = useTranslations('admin.adminTenantsPage');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    name: '',
    slug: '',
    domain: '',
    plan: 'free',
    primaryColor: '#3b82f6',
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    slug: '',
    domain: '',
    plan: 'free',
    primaryColor: '#3b82f6',
    isActive: true,
  });
  const [editSnapshot, setEditSnapshot] = useState<EditForm | null>(null);
  const isEditDirty = useMemo(
    () => editSnapshot !== null && JSON.stringify(editForm) !== JSON.stringify(editSnapshot),
    [editForm, editSnapshot],
  );
  const guardEdit = useUnsavedChangesGuard(isEditDirty);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadTenants = () => {
    apiClient
      .get<Tenant[]>('/api/v1/admin/tenants')
      .then((res) => {
        if (res.success && res.data) setTenants(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.slug) {
      toast.error(t('validateNameSlug'));
      return;
    }
    const res = await apiClient.post('/api/v1/admin/tenants', {
      name: form.name,
      slug: form.slug,
      domain: form.domain || null,
      plan: form.plan,
      primaryColor: form.primaryColor,
    });
    if (res.success) {
      toast.success(t('createdToast'));
      setShowForm(false);
      setForm({ name: '', slug: '', domain: '', plan: 'free', primaryColor: '#3b82f6' });
      loadTenants();
    } else {
      toast.error(res.error || t('createError'));
    }
  };

  const startEdit = (tenant: Tenant) => {
    setEditingId(tenant.id);
    const snapshot = {
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain || '',
      plan: tenant.plan,
      primaryColor: tenant.primaryColor || '#3b82f6',
      isActive: tenant.isActive,
    };
    setEditForm(snapshot);
    setEditSnapshot(snapshot);
  };

  const cancelEdit = () =>
    guardEdit(() => {
      setEditingId(null);
      setEditSnapshot(null);
    });

  const saveEdit = async (id: number) => {
    const res = await apiClient.patch(`/api/v1/admin/tenants/${id}`, {
      name: editForm.name,
      slug: editForm.slug,
      domain: editForm.domain || null,
      plan: editForm.plan,
      primaryColor: editForm.primaryColor,
      isActive: editForm.isActive,
    });
    if (res.success) {
      toast.success(t('updatedToast'));
      setEditingId(null);
      setEditSnapshot(null);
      loadTenants();
    } else {
      toast.error(res.error || t('errorGeneric'));
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/tenants/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? t('disabledToast') : t('enabledToast'));
    else toast.error(res.error || t('updateError'));
    loadTenants();
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/tenants/${id}`);
    if (res.success) toast.success(t('deletedToast'));
    else toast.error(t('deleteError'));
    loadTenants();
  };

  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 63);
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={5} columns={6} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t('cancel') : t('createBtn')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label={t('nameLabel')}
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm({ ...form, name, slug: autoSlug(name) });
              }}
              placeholder={t('namePh')}
            />
            <Input
              label={t('slugLabel')}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder={t('slugPh')}
            />
            <Input
              label={t('domainLabel')}
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder={t('domainPh')}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('planLabel')}</label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('primaryColorLabel')}</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="h-10 w-full rounded"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>{t('create')}</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <th className="px-3 py-2">{t('colName')}</th>
              <th className="px-3 py-2">{t('colSlug')}</th>
              <th className="px-3 py-2">{t('colDomain')}</th>
              <th className="px-3 py-2">{t('colPlan')}</th>
              <th className="px-3 py-2">{t('colUsers')}</th>
              <th className="px-3 py-2">{t('colStatus')}</th>
              <th className="px-3 py-2">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr
                key={tenant.id}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
              >
                {editingId === tenant.id ? (
                  <td colSpan={7} className="px-3 py-3">
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium">{t('nameLabel')}</label>
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">{t('slugLabel')}</label>
                          <input
                            value={editForm.slug}
                            onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">{t('colDomain')}</label>
                          <input
                            value={editForm.domain}
                            onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">{t('plan')}</label>
                          <select
                            value={editForm.plan}
                            onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={(e) =>
                              setEditForm({ ...editForm, isActive: e.target.checked })
                            }
                          />
                          {t('active')}
                        </label>
                        <button
                          onClick={cancelEdit}
                          className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"
                          aria-label={t('cancelAria')}
                        >
                          <Close size={16} />
                        </button>
                        <button
                          onClick={() => saveEdit(tenant.id)}
                          className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: tenant.primaryColor || '#3b82f6' }}
                        />
                        {tenant.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{tenant.slug}</td>
                    <td className="px-3 py-2 text-xs">
                      {tenant.domain || (
                        <span className="text-[var(--color-text-secondary)]">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{tenant._count?.users ?? 0}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleActive(tenant.id, tenant.isActive)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          tenant.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {tenant.isActive ? t('statusActive') : t('statusInactive')}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(tenant)}
                          className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(tenant.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">{t('empty')}</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message={t('deleteMsg')}
      />
    </div>
  );
}
