'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { formatPrice } from '@/utils/format';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';

interface WholesaleRule {
  id: number;
  ruleType: string;
  productId: number | null;
  product?: { id: number; name: string; code: string } | null;
  value: string | number;
  isActive: boolean;
  createdAt: string;
}

const RULE_TYPE_UNIT: Record<string, 'currency' | 'count'> = {
  min_order_amount: 'currency',
  min_quantity: 'count',
  multiplicity: 'count',
};

export default function AdminWholesaleRulesPage() {
  const t = useTranslations('admin.wholesaleRulesPage');
  const RULE_TYPE_LABELS: Record<string, string> = {
    min_order_amount: t('typeMinAmount'),
    min_quantity: t('typeMinQty'),
    multiplicity: t('typeMultiplicity'),
  };
  const RULE_TYPE_OPTIONS = Object.entries(RULE_TYPE_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));
  const formatRuleValue = (ruleType: string, value: number): string => {
    if (RULE_TYPE_UNIT[ruleType] === 'currency') return formatPrice(value);
    return `${value} ${t('qtyUnit')}`;
  };
  const [rules, setRules] = useState<WholesaleRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    ruleType: 'min_order_amount',
    productId: '',
    value: '',
    isActive: true,
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadRules = () => {
    setIsLoading(true);
    apiClient
      .get<WholesaleRule[]>('/api/v1/admin/wholesale-rules')
      .then((res) => {
        if (res.success && res.data) setRules(res.data);
        else toast.error(t('loadError'));
      })
      .catch(() => toast.error(t('networkError')))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadRules();
  }, []);

  const resetForm = () => {
    setForm({ ruleType: 'min_order_amount', productId: '', value: '', isActive: true });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (rule: WholesaleRule) => {
    setForm({
      ruleType: rule.ruleType,
      productId: rule.productId ? String(rule.productId) : '',
      value: String(rule.value),
      isActive: rule.isActive,
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ruleType: form.ruleType,
        productId: form.productId ? Number(form.productId) : null,
        value: Number(form.value),
        isActive: form.isActive,
      };

      const res = editingId
        ? await apiClient.put(`/api/v1/admin/wholesale-rules/${editingId}`, payload)
        : await apiClient.post('/api/v1/admin/wholesale-rules', payload);

      if (res.success) {
        toast.success(editingId ? t('savedToast') : t('createdToast'));
        resetForm();
        loadRules();
      } else {
        toast.error(res.error || t('saveError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/wholesale-rules/${id}`);
    if (res.success) {
      toast.success(t('deletedToast'));
    } else {
      toast.error(t('deleteError'));
    }
    loadRules();
  };

  const handleToggle = async (rule: WholesaleRule) => {
    const res = await apiClient.put(`/api/v1/admin/wholesale-rules/${rule.id}`, {
      isActive: !rule.isActive,
    });
    if (res.success) toast.success(rule.isActive ? t('disabledToast') : t('enabledToast'));
    loadRules();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          {t('add')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{editingId ? t('edit') : t('newRule')}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {t('ruleType')}
              </label>
              <Select
                options={RULE_TYPE_OPTIONS}
                value={form.ruleType}
                onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
              />
            </div>
            <Input
              label={t('productIdLabel')}
              type="number"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              placeholder={t('productIdPh')}
            />
            <Input
              label={t('valueLabel')}
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={t('valuePh')}
            />
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-[var(--color-primary)]"
                />
                {t('active')}
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} isLoading={isSaving} disabled={!form.value}>
              {editingId ? t('save') : t('create')}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={5} columns={5} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">{t('colType')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('colProduct')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('colValue')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('colStatus')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
                >
                  <td className="px-4 py-3">{RULE_TYPE_LABELS[rule.ruleType]}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {rule.product
                      ? `${rule.product.name} (${rule.product.code})`
                      : t('allProducts')}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatRuleValue(rule.ruleType, Number(rule.value))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {rule.isActive ? t('statusActive') : t('statusInactive')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="mr-2 text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
                      <span className="text-3xl" aria-hidden="true">
                        📦
                      </span>
                      <p className="text-sm font-medium">{t('emptyTitle')}</p>
                      <p className="max-w-md text-xs">{t('emptyHint')}</p>
                      <button
                        onClick={() => {
                          resetForm();
                          setShowForm(true);
                        }}
                        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
                      >
                        {t('addFirst')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
