'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface HomepageBlock {
  key: string;
  label: string;
  enabled: boolean;
}

export default function AdminHomepagePage() {
  const t = useTranslations('admin.homepageBlocks');
  const [blocks, setBlocks] = useState<HomepageBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  // Optimistic-lock token: the layout's updatedAt as loaded. Sent back on save
  // so a concurrent reorder by another admin is rejected (409) not clobbered.
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  // SEO text shown by the "seo_text" homepage block (stored as HTML).
  const [seoText, setSeoText] = useState('');
  const [seoSaving, setSeoSaving] = useState(false);

  const loadSeoText = useCallback(() => {
    apiClient
      .get<{ seoText: string }>('/api/v1/admin/homepage')
      .then((res) => {
        if (res.success && res.data) setSeoText(res.data.seoText ?? '');
      })
      .catch(() => {});
  }, []);

  const saveSeoText = async () => {
    setSeoSaving(true);
    try {
      const res = await apiClient.patch('/api/v1/admin/homepage', { seoText });
      if (res.success) toast.success(t('seoSavedToast'));
      else toast.error(res.error || t('seoSaveError'));
    } catch {
      toast.error(t('networkError'));
    } finally {
      setSeoSaving(false);
    }
  };

  const loadBlocks = useCallback(() => {
    apiClient
      .get<{ blocks: HomepageBlock[]; updatedAt: string | null }>('/api/v1/admin/homepage-blocks')
      .then((res) => {
        if (res.success && res.data) {
          setBlocks(res.data.blocks);
          setExpectedUpdatedAt(res.data.updatedAt);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadBlocks();
    loadSeoText();
  }, [loadBlocks, loadSeoText]);

  // Warn user if they try to leave with unsaved changes
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

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
      const res = await apiClient.put<{ updated: boolean; updatedAt: string | null }>(
        '/api/v1/admin/homepage-blocks',
        { blocks, expectedUpdatedAt },
      );
      if (res.success) {
        toast.success(t('savedToast'));
        setHasChanges(false);
        // Advance the token so the next save in this session isn't a false 409.
        setExpectedUpdatedAt(res.data?.updatedAt ?? null);
      } else if (res.statusCode === 409) {
        toast.error(t('conflictToast'));
        loadBlocks();
      } else {
        toast.error(res.error || t('saveError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {t('viewHome')}
          </a>
          <Button onClick={saveBlocks} disabled={!hasChanges || isSaving}>
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div
            key={block.key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleDrop(e, index)}
            className={`flex items-center gap-4 rounded-[var(--radius)] border p-4 transition-colors ${
              dragOverIndex === index
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg)]'
            } ${!block.enabled ? 'opacity-50' : ''}`}
          >
            <span className="cursor-grab text-[var(--color-text-secondary)]" title={t('drag')}>
              ⠿
            </span>

            <span className="w-8 text-center text-sm font-medium text-[var(--color-text-secondary)]">
              {index + 1}
            </span>

            <span className="flex-1 text-sm font-medium">{block.label}</span>

            <button
              onClick={() => toggleBlock(index)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                block.enabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {block.enabled ? t('enabled') : t('disabled')}
            </button>
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-[var(--radius)] border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
          <p className="text-sm text-amber-800">
            <strong>{t('unsavedChanges')}</strong> {t('unsavedTail')}
          </p>
          <Button onClick={saveBlocks} disabled={isSaving} size="sm">
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      )}

      <div className="mt-8 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="text-sm font-semibold">{t('seoTitle')}</h3>
        <p className="mb-3 mt-1 text-xs text-[var(--color-text-secondary)]">{t('seoHint')}</p>
        <textarea
          value={seoText}
          onChange={(e) => setSeoText(e.target.value)}
          rows={8}
          placeholder={t('seoPlaceholder')}
          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-xs"
        />
        <div className="mt-3">
          <Button onClick={saveSeoText} disabled={seoSaving}>
            {seoSaving ? t('saving') : t('seoSave')}
          </Button>
        </div>
      </div>
    </div>
  );
}
