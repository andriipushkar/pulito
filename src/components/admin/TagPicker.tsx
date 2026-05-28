'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string | null;
}

interface Props {
  entityType: 'order' | 'product' | 'user';
  entityId: number;
}

export default function TagPicker({ entityType, entityId }: Props) {
  const t = useTranslations('admin.tagPicker');
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [assigned, setAssigned] = useState<Tag[]>([]);
  const [draftName, setDraftName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const fetchAll = async () => {
    const [tagsRes, assignedRes] = await Promise.all([
      apiClient.get<Tag[]>('/api/v1/admin/tags'),
      apiClient.get<Tag[]>(
        `/api/v1/admin/entity-tags?entityType=${entityType}&entityId=${entityId}`,
      ),
    ]);
    if (tagsRes.success && tagsRes.data) setAllTags(tagsRes.data);
    if (assignedRes.success && assignedRes.data) setAssigned(assignedRes.data);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const attach = async (tagId: number) => {
    const res = await apiClient.post<Tag>('/api/v1/admin/entity-tags', {
      entityType,
      entityId,
      tagId,
    });
    if (res.success && res.data) {
      setAssigned((prev) =>
        prev.find((tg) => tg.id === res.data!.id) ? prev : [...prev, res.data!],
      );
    }
  };

  const detach = async (tagId: number) => {
    const res = await apiClient.delete(
      `/api/v1/admin/entity-tags?entityType=${entityType}&entityId=${entityId}&tagId=${tagId}`,
    );
    if (res.success) {
      setAssigned((prev) => prev.filter((t) => t.id !== tagId));
    }
  };

  const createAndAttach = async () => {
    if (!draftName.trim()) return;
    const res = await apiClient.post<Tag>('/api/v1/admin/tags', { name: draftName });
    if (res.success && res.data) {
      await attach(res.data.id);
      setAllTags((prev) =>
        prev.find((tg) => tg.id === res.data!.id) ? prev : [...prev, res.data!],
      );
      setDraftName('');
      toast.success(t('created'));
    }
  };

  const available = allTags.filter((tg) => !assigned.find((a) => a.id === tg.id));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        {assigned.map((tag) => (
          <button
            key={tag.id}
            onClick={() => detach(tag.id)}
            className="group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: tag.color || 'var(--color-bg-secondary)',
              color: tag.color ? '#fff' : 'var(--color-text)',
            }}
            title={t('detachTitle')}
          >
            {tag.name}
            <span className="opacity-0 group-hover:opacity-100">×</span>
          </button>
        ))}
        <button
          onClick={() => setIsOpen((p) => !p)}
          className="rounded-full border border-dashed border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          {t('addTag')}
        </button>
      </div>

      {isOpen && (
        <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs">
          {available.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {available.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => attach(tag.id)}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: tag.color || 'var(--color-bg-secondary)',
                    color: tag.color ? '#fff' : 'var(--color-text)',
                  }}
                >
                  + {tag.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createAndAttach();
              }}
              placeholder={t('newTagPlaceholder')}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
            />
            <button
              onClick={createAndAttach}
              className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white"
            >
              {t('create')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
