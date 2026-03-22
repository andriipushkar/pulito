'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface StockItem {
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  reserved: number;
}

interface WarehouseData {
  id: number;
  name: string;
  code: string;
  city: string;
  isDefault: boolean;
  stock: StockItem[];
}

export default function AdminWarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [warehouse, setWarehouse] = useState<WarehouseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updateForm, setUpdateForm] = useState({ productId: '', quantity: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const loadWarehouse = () => {
    setIsLoading(true);
    apiClient
      .get<WarehouseData>(`/api/v1/admin/warehouses/${id}`)
      .then((res) => {
        if (res.success && res.data) setWarehouse(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadWarehouse(); }, [id]);

  const handleUpdateStock = async () => {
    const pid = Number(updateForm.productId);
    const qty = Number(updateForm.quantity);
    if (!pid || isNaN(qty)) {
      toast.error('Вкажіть ID товару та кількість');
      return;
    }
    setIsUpdating(true);
    const res = await apiClient.patch(`/api/v1/admin/warehouses/${id}/stock`, {
      productId: pid,
      quantity: qty,
    });
    setIsUpdating(false);
    if (res.success) {
      toast.success('Залишок оновлено');
      setUpdateForm({ productId: '', quantity: '' });
      loadWarehouse();
    } else {
      toast.error(res.error || 'Помилка оновлення');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  if (!warehouse) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">Склад не знайдено</p>
        <Link href="/admin/warehouses" className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline">
          До списку складів
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/warehouses" className="text-sm text-[var(--color-primary)] hover:underline">← Склади</Link>
        <h2 className="mt-1 text-xl font-bold">
          {warehouse.name}
          {warehouse.isDefault && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-sm font-normal text-blue-700">Основний</span>
          )}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Код: {warehouse.code} | Місто: {warehouse.city || '—'}
        </p>
      </div>

      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Оновити залишок</h3>
        <div className="flex flex-wrap gap-3">
          <Input
            value={updateForm.productId}
            onChange={(e) => setUpdateForm({ ...updateForm, productId: e.target.value })}
            placeholder="ID товару"
            className="w-32"
          />
          <Input
            type="number"
            value={updateForm.quantity}
            onChange={(e) => setUpdateForm({ ...updateForm, quantity: e.target.value })}
            placeholder="Кількість"
            className="w-32"
          />
          <Button onClick={handleUpdateStock} isLoading={isUpdating}>Оновити</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Товар</th>
              <th className="px-4 py-3 text-left font-medium">Код</th>
              <th className="px-4 py-3 text-right font-medium">Кількість</th>
              <th className="px-4 py-3 text-right font-medium">Зарезервовано</th>
              <th className="px-4 py-3 text-right font-medium">Доступно</th>
            </tr>
          </thead>
          <tbody>
            {warehouse.stock.map((item) => (
              <tr key={item.productId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3 font-medium">{item.productName}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.productCode}</td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{item.reserved}</td>
                <td className="px-4 py-3 text-right">
                  <span className={item.quantity - item.reserved <= 0 ? 'font-medium text-[var(--color-danger)]' : ''}>
                    {item.quantity - item.reserved}
                  </span>
                </td>
              </tr>
            ))}
            {warehouse.stock.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  На складі немає товарів
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
