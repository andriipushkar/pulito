'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
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
      toast.error('Назва та slug обов\'язкові');
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
      toast.success('Тенант створено');
      setShowForm(false);
      setForm({ name: '', slug: '', domain: '', plan: 'free', primaryColor: '#3b82f6' });
      loadTenants();
    } else {
      toast.error(res.error || 'Помилка створення');
    }
  };

  const startEdit = (t: Tenant) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      slug: t.slug,
      domain: t.domain || '',
      plan: t.plan,
      primaryColor: t.primaryColor || '#3b82f6',
      isActive: t.isActive,
    });
  };

  const saveEdit = async (id: number) => {
    const res = await apiClient.patch(`/api/v1/admin/tenants/${id}`, {
      name: editForm.name,
      slug: editForm.slug,
      domain: editForm.domain || null,
      plan: editForm.plan,
      primaryColor: editForm.primaryColor,
      isActive: editForm.isActive,
    });
    if (res.success) toast.success('Тенант оновлено');
    else toast.error(res.error || 'Помилка');
    setEditingId(null);
    loadTenants();
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/tenants/${id}`, { isActive: !isActive });
    if (res.success) toast.success(isActive ? 'Тенант вимкнено' : 'Тенант увімкнено');
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
    if (res.success) toast.success('Тенант видалено');
    else toast.error('Помилка видалення');
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
        <h2 className="text-xl font-bold">Тенанти (SaaS)</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Скасувати' : '+ Створити тенант'}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="Назва"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm({ ...form, name, slug: autoSlug(name) });
              }}
              placeholder="My Store"
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="my-store"
            />
            <Input
              label="Домен (необов'язково)"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="shop.example.com"
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">План</label>
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
              <label className="mb-1 block text-sm font-medium">Основний колір</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="h-10 w-full rounded"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>Створити</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <th className="px-3 py-2">Назва</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Домен</th>
              <th className="px-3 py-2">План</th>
              <th className="px-3 py-2">Користувачі</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Дії</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr
                key={t.id}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
              >
                {editingId === t.id ? (
                  <td colSpan={7} className="px-3 py-3">
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium">Назва</label>
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Slug</label>
                          <input
                            value={editForm.slug}
                            onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Домен</label>
                          <input
                            value={editForm.domain}
                            onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">План</label>
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
                          Активний
                        </label>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"
                        >
                          <Close size={16} />
                        </button>
                        <button
                          onClick={() => saveEdit(t.id)}
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
                          style={{ backgroundColor: t.primaryColor || '#3b82f6' }}
                        />
                        {t.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.domain || <span className="text-[var(--color-text-secondary)]">--</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{t._count?.users ?? 0}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleActive(t.id, t.isActive)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          t.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.isActive ? 'Активний' : 'Вимкнено'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(t)}
                          className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Видалити
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
          <div className="py-8 text-center text-[var(--color-text-secondary)]">
            Тенантів немає
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message="Видалити тенант? Всі пов'язані дані будуть видалені."
      />
    </div>
  );
}
