'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface WholesaleRule {
  id: number;
  ruleType: string;
  productId: number | null;
  product?: { id: number; name: string; code: string } | null;
  value: string | number;
  isActive: boolean;
  createdAt: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  min_order_amount: 'Мін. сума замовлення',
  min_quantity: 'Мін. кількість товару',
  multiplicity: 'Кратність замовлення',
};

const RULE_TYPE_OPTIONS = Object.entries(RULE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));

export default function AdminWholesaleRulesPage() {
  const [rules, setRules] = useState<WholesaleRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ ruleType: 'min_order_amount', productId: '', value: '', isActive: true });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadRules = () => {
    setIsLoading(true);
    apiClient
      .get<WholesaleRule[]>('/api/v1/admin/wholesale-rules')
      .then((res) => { if (res.success && res.data) setRules(res.data); })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadRules(); }, []);

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
        resetForm();
        loadRules();
      }
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
    await apiClient.delete(`/api/v1/admin/wholesale-rules/${id}`);
    loadRules();
  };

  const handleToggle = async (rule: WholesaleRule) => {
    await apiClient.put(`/api/v1/admin/wholesale-rules/${rule.id}`, { isActive: !rule.isActive });
    loadRules();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Оптові правила</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>Додати правило</Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{editingId ? 'Редагувати' : 'Нове правило'}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Тип правила</label>
              <Select
                options={RULE_TYPE_OPTIONS}
                value={form.ruleType}
                onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
              />
            </div>
            <Input
              label="ID товару (опціонально)"
              type="number"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              placeholder="Для всіх товарів"
            />
            <Input
              label="Значення *"
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="0.00"
            />
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-[var(--color-primary)]" />
                Активне
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} isLoading={isSaving} disabled={!form.value}>
              {editingId ? 'Зберегти' : 'Створити'}
            </Button>
            <Button variant="outline" onClick={resetForm}>Скасувати</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">Тип</th>
                <th className="px-4 py-3 text-left font-medium">Товар</th>
                <th className="px-4 py-3 text-right font-medium">Значення</th>
                <th className="px-4 py-3 text-center font-medium">Статус</th>
                <th className="px-4 py-3 text-right font-medium">Дії</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                  <td className="px-4 py-3">{RULE_TYPE_LABELS[rule.ruleType]}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {rule.product ? `${rule.product.name} (${rule.product.code})` : 'Всі товари'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(rule.value)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(rule)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {rule.isActive ? 'Активне' : 'Вимкнене'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEdit(rule)} className="mr-2 text-xs text-[var(--color-primary)] hover:underline">Редагувати</button>
                    <button onClick={() => handleDelete(rule.id)} className="text-xs text-[var(--color-danger)] hover:underline">Видалити</button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">Правил немає</td></tr>
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
        message="Видалити це правило?"
      />
    </div>
  );
}
