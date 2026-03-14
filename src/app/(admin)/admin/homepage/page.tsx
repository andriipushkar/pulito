'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface HomepageBlock {
  key: string;
  label: string;
  enabled: boolean;
}

export default function AdminHomepagePage() {
  const [blocks, setBlocks] = useState<HomepageBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const loadBlocks = useCallback(() => {
    apiClient
      .get<HomepageBlock[]>('/api/v1/admin/homepage-blocks')
      .then((res) => {
        if (res.success && res.data) setBlocks(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const toggleBlock = (index: number) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setBlocks(updated);
    setHasChanges(true);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('dragIndex', String(index));
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const dragIndex = Number(e.dataTransfer.getData('dragIndex'));
    if (dragIndex === targetIndex) return;

    const updated = [...blocks];
    const [dragged] = updated.splice(dragIndex, 1);
    updated.splice(targetIndex, 0, dragged);
    setBlocks(updated);
    setHasChanges(true);
  };

  const saveBlocks = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.put('/api/v1/admin/homepage-blocks', blocks);
      if (res.success) {
        toast.success('Блоки збережено');
        setHasChanges(false);
      } else {
        toast.error(res.error || 'Помилка збереження');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Блоки головної сторінки</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Перетягуйте блоки для зміни порядку. Вимикайте непотрібні блоки.
          </p>
        </div>
        <Button onClick={saveBlocks} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Збереження...' : 'Зберегти'}
        </Button>
      </div>

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div
            key={block.key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleDrop(e, index)}
            className={`flex items-center gap-4 rounded-[var(--radius)] border p-4 transition-colors ${
              dragOverIndex === index
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg)]'
            } ${!block.enabled ? 'opacity-50' : ''}`}
          >
            <span className="cursor-grab text-[var(--color-text-secondary)]" title="Перетягнути">
              ⠿
            </span>

            <span className="w-8 text-center text-sm font-medium text-[var(--color-text-secondary)]">
              {index + 1}
            </span>

            <span className="flex-1 text-sm font-medium">
              {block.label}
            </span>

            <button
              onClick={() => toggleBlock(index)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                block.enabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {block.enabled ? 'Увімкнено' : 'Вимкнено'}
            </button>
          </div>
        ))}
      </div>

      {hasChanges && (
        <p className="mt-4 text-sm text-[var(--color-warning)]">
          Є незбережені зміни
        </p>
      )}
    </div>
  );
}
