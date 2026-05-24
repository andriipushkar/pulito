'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

interface Brand {
  id: number;
  name: string;
  slug: string;
  logoPath?: string | null;
}

interface BrandSelectorProps {
  value: string;
  onChange: (brandId: string) => void;
  label?: string;
}

/**
 * Select an existing brand from the admin catalogue, or create a new one
 * inline — the most common reason admins bounce out of the product form is
 * "i need to add a new manufacturer first", and forcing them through a
 * separate /admin/brands page breaks the flow.
 */
export default function BrandSelector({
  value,
  onChange,
  label = 'Торгова марка',
}: BrandSelectorProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadBrands = () => {
    setIsLoading(true);
    apiClient
      .get<Brand[]>('/api/v1/admin/brands?includeHidden=true')
      .then((res) => {
        if (res.success && res.data) setBrands(res.data);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Введіть назву торгової марки');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiClient.post<Brand>('/api/v1/admin/brands', { name });
      if (res.success && res.data) {
        toast.success(`Торгової марки "${res.data.name}" створено`);
        const newId = res.data.id;
        // Optimistic: append + select before reload so the UI doesn't flash.
        setBrands((prev) =>
          [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name, 'uk')),
        );
        onChange(String(newId));
        setNewName('');
        setShowCreate(false);
        loadBrands();
      } else {
        toast.error(res.error || 'Не вдалося створити торгової марки');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  const options = [
    { value: '', label: 'Без торгової марки' },
    ...brands.map((b) => ({ value: String(b.id), label: b.name })),
  ];

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex items-stretch gap-2">
        <div className="flex-1">
          <Select
            options={options}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Скасувати' : '+ Новий'}
        </Button>
      </div>

      {showCreate && (
        <div className="mt-2 flex items-end gap-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium">Назва нового торгової марки</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Наприклад: Procter &amp; Gamble"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <Button onClick={handleCreate} isLoading={isSaving} size="sm">
            Створити
          </Button>
        </div>
      )}
    </div>
  );
}
