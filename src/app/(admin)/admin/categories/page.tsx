'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
  parentId: number | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  nameEn: string | null;
  descriptionEn: string | null;
  seoTitleEn: string | null;
  seoDescriptionEn: string | null;
  coverImage: string | null;
  iconPath: string | null;
  version?: number;
  _count?: { products: number; children: number };
}

interface CategoryEditForm {
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
  parentId: string; // '' means root
  description: string;
  seoTitle: string;
  seoDescription: string;
  nameEn: string;
  descriptionEn: string;
  seoTitleEn: string;
  seoDescriptionEn: string;
  coverImage: string;
  iconPath: string;
}

export default function AdminCategoriesPage() {
  const t = useTranslations('admin.categoriesPage');
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CategoryEditForm>({
    name: '',
    slug: '',
    sortOrder: 0,
    isVisible: true,
    parentId: '',
    description: '',
    seoTitle: '',
    seoDescription: '',
    nameEn: '',
    descriptionEn: '',
    seoTitleEn: '',
    seoDescriptionEn: '',
    coverImage: '',
    iconPath: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [mergeSource, setMergeSource] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const emptyCreateForm: CategoryEditForm = {
    name: '',
    slug: '',
    sortOrder: 0,
    isVisible: true,
    parentId: '',
    description: '',
    seoTitle: '',
    seoDescription: '',
    nameEn: '',
    descriptionEn: '',
    seoTitleEn: '',
    seoDescriptionEn: '',
    coverImage: '',
    iconPath: '',
  };
  const [createForm, setCreateForm] = useState<CategoryEditForm>(emptyCreateForm);
  const createIconInputRef = useRef<HTMLInputElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'merge' | 'delete';
    id?: number;
    name?: string;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkParent, setBulkParent] = useState<string>('');
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini' | 'rules'>('claude');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pulito.aiProvider') : null;
    if (stored === 'claude' || stored === 'gemini' || stored === 'rules') {
      setAiProvider(stored);
    }
  }, []);
  const updateAiProvider = (v: 'claude' | 'gemini' | 'rules') => {
    setAiProvider(v);
    if (typeof window !== 'undefined') localStorage.setItem('pulito.aiProvider', v);
  };

  const askConflictOverwrite = (
    next: {
      description: string;
      seoTitle: string;
      seoDescription: string;
    },
    current: {
      description: string;
      seoTitle: string;
      seoDescription: string;
    },
  ): { description: string; seoTitle: string; seoDescription: string } | null => {
    // Returns next-state to apply, or null when caller should keep current.
    const conflicts: string[] = [];
    if (current.description.trim()) conflicts.push(t('conflictDesc'));
    if (current.seoTitle.trim()) conflicts.push(t('conflictSeoTitle'));
    if (current.seoDescription.trim()) conflicts.push(t('conflictSeoDesc'));
    if (conflicts.length === 0) return next;
    const ok = window.confirm(t('replaceConfirm', { fields: conflicts.join(', ') }));
    if (ok) return next;
    return {
      description: current.description || next.description,
      seoTitle: current.seoTitle || next.seoTitle,
      seoDescription: current.seoDescription || next.seoDescription,
    };
  };

  const handleGenerateForCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error(t('enterNameFirst'));
      return;
    }
    setIsGeneratingAi(true);
    try {
      const res = await apiClient.post<{
        description: string;
        seoTitle: string;
        seoDescription: string;
      }>('/api/v1/admin/categories/ai-generate-preview', {
        name: createForm.name.trim(),
        parentId: createForm.parentId ? Number(createForm.parentId) : null,
        provider: aiProvider,
      });
      if (!res.success || !res.data) {
        toast.error(res.error || t('generateFailed'));
        return;
      }
      const merged = askConflictOverwrite(res.data, {
        description: createForm.description,
        seoTitle: createForm.seoTitle,
        seoDescription: createForm.seoDescription,
      });
      if (merged) {
        setCreateForm((prev) => ({ ...prev, ...merged }));
        toast.success(t('generated'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleGenerateForEdit = async (catId: number) => {
    setIsGeneratingAi(true);
    try {
      const res = await apiClient.post<{
        description: string;
        seoTitle: string;
        seoDescription: string;
      }>(`/api/v1/admin/categories/${catId}/ai-generate`, { provider: aiProvider });
      if (!res.success || !res.data) {
        toast.error(res.error || t('generateFailed'));
        return;
      }
      const merged = askConflictOverwrite(res.data, {
        description: editForm.description,
        seoTitle: editForm.seoTitle,
        seoDescription: editForm.seoDescription,
      });
      if (merged) {
        setEditForm((prev) => ({ ...prev, ...merged }));
        toast.success(t('generated'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelected = () => setSelectedIds(new Set());

  const runBulk = async (action: 'show' | 'hide' | 'delete' | 'setParent') => {
    if (selectedIds.size === 0) return;
    if (action === 'delete' && !window.confirm(t('bulkDeleteConfirm', { count: selectedIds.size })))
      return;

    setIsBulkRunning(true);
    try {
      const payload: { ids: number[]; action: string; parentId?: number | null } = {
        ids: Array.from(selectedIds),
        action,
      };
      if (action === 'setParent') {
        payload.parentId = bulkParent === '' ? null : Number(bulkParent);
      }
      const res = await apiClient.post('/api/v1/admin/categories/bulk', payload);
      if (res.success) {
        toast.success(t('bulkDone'));
        clearSelected();
        loadCategories();
      } else {
        toast.error(res.error || t('bulkError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsBulkRunning(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Touch needs a hold-delay so scrolling on mobile doesn't trigger drag
    // every time the operator tries to swipe past a row.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadCategories = useCallback(() => {
    setIsLoading(true);
    apiClient
      .get<AdminCategory[]>('/api/v1/admin/categories')
      .then((res) => {
        if (res.success && res.data) setCategories(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Honour ?edit=<id> deep-links (used by SEO audit). When the list finishes
  // loading and the matching category is present, open it inline for editing.
  useEffect(() => {
    if (typeof window === 'undefined' || categories.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get('edit');
    if (!editParam) return;
    const id = Number(editParam);
    const cat = categories.find((c) => c.id === id);
    if (cat) handleEdit(cat);
  }, [categories]);

  const rootCategories = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenOf = (parentId: number) =>
    categories.filter((c) => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const handleEdit = (cat: AdminCategory) => {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sortOrder,
      isVisible: cat.isVisible,
      parentId: cat.parentId ? String(cat.parentId) : '',
      description: cat.description || '',
      seoTitle: cat.seoTitle || '',
      seoDescription: cat.seoDescription || '',
      nameEn: cat.nameEn || '',
      descriptionEn: cat.descriptionEn || '',
      seoTitleEn: cat.seoTitleEn || '',
      seoDescriptionEn: cat.seoDescriptionEn || '',
      coverImage: cat.coverImage || '',
      iconPath: cat.iconPath || '',
    });
  };

  const uploadIcon = async (file: File): Promise<string | null> => {
    setIsUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'categories');
      const res = await apiClient.upload<{ path: string }>('/api/v1/admin/upload', formData);
      if (res.success && res.data) {
        toast.success(t('iconUploaded'));
        return res.data.path;
      }
      toast.error(res.error || t('iconUploadError'));
      return null;
    } catch {
      toast.error(t('networkError'));
      return null;
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleIconUpload = async (file: File) => {
    const path = await uploadIcon(file);
    if (path) setEditForm((prev) => ({ ...prev, iconPath: path }));
  };

  const handleCreateIconUpload = async (file: File) => {
    const path = await uploadIcon(file);
    if (path) setCreateForm((prev) => ({ ...prev, iconPath: path }));
  };

  const handleSave = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const current = categories.find((c) => c.id === editingId);
      const payload = {
        name: editForm.name,
        slug: editForm.slug,
        sortOrder: editForm.sortOrder,
        isVisible: editForm.isVisible,
        parentId: editForm.parentId === '' ? null : Number(editForm.parentId),
        description: editForm.description.trim() || null,
        seoTitle: editForm.seoTitle.trim() || null,
        seoDescription: editForm.seoDescription.trim() || null,
        nameEn: editForm.nameEn.trim() || null,
        descriptionEn: editForm.descriptionEn.trim() || null,
        seoTitleEn: editForm.seoTitleEn.trim() || null,
        seoDescriptionEn: editForm.seoDescriptionEn.trim() || null,
        coverImage: editForm.coverImage.trim() || null,
        iconPath: editForm.iconPath.trim() || null,
        version: current?.version,
      };
      const res = await apiClient.put(`/api/v1/admin/categories/${editingId}`, payload);
      if (res.success) {
        toast.success(t('categoryUpdated'));
        setEditingId(null);
        loadCategories();
      } else if (res.statusCode === 409) {
        toast.error(res.error || t('conflictError'), {
          duration: 12000,
          action: {
            label: t('refreshAction'),
            onClick: () => {
              loadCategories();
              setEditingId(null);
              toast.success(t('refreshedRetry'));
            },
          },
        });
      } else {
        toast.error(res.error || t('updateError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    const activeCat = categories.find((c) => c.id === activeId);
    const overCat = categories.find((c) => c.id === overId);
    if (!activeCat || !overCat) return;

    // Different parent → confirm reparent. Drag-drop between levels (e.g.
    // moving a root category under another root, or lifting a child to root)
    // is destructive enough that we ask before executing — silently moving
    // tens of products into a new branch is too easy to do by accident.
    if (activeCat.parentId !== overCat.parentId) {
      // Determine new parent:
      //  • drop on root cat → become its child
      //  • drop on child cat → become a sibling of that child (= same parentId)
      const newParentId = overCat.parentId === null ? overCat.id : overCat.parentId;
      // Forbid 3-level depth (root → child → grandchild). Schema allows it but
      // the UI only renders 2 levels — keep them in sync.
      if (newParentId !== null && activeCat.id === newParentId) return;
      const ok = window.confirm(
        t('reparentConfirm', {
          name: activeCat.name,
          target: newParentId
            ? (categories.find((c) => c.id === newParentId)?.name ?? '')
            : t('topLevel'),
        }),
      );
      if (!ok) return;

      const res = await apiClient.put(`/api/v1/admin/categories/${activeCat.id}`, {
        parentId: newParentId,
      });
      if (res.success) {
        toast.success(t('categoryMoved'));
        loadCategories();
      } else {
        toast.error(res.error || t('moveError'));
      }
      return;
    }

    const siblings = activeCat.parentId ? childrenOf(activeCat.parentId) : rootCategories;
    const oldIndex = siblings.findIndex((c) => c.id === activeId);
    const newIndex = siblings.findIndex((c) => c.id === overId);
    const reordered = arrayMove(siblings, oldIndex, newIndex);

    // Optimistic update
    const newCategories = categories.map((c) => {
      const idx = reordered.findIndex((r) => r.id === c.id);
      if (idx !== -1) return { ...c, sortOrder: idx };
      return c;
    });
    setCategories(newCategories);

    const res = await apiClient.post('/api/v1/admin/categories/reorder', {
      items: reordered.map((cat, idx) => ({ id: cat.id, sortOrder: idx })),
    });
    if (!res.success) {
      toast.error(res.error || t('reorderError'));
      loadCategories();
    }
  };

  const handleMerge = () => {
    if (!mergeSource || !mergeTarget) return;
    const targetId = Number(mergeTarget);
    if (mergeSource === targetId) return;
    setConfirmAction({ type: 'merge' });
  };

  const executeMerge = async () => {
    if (!mergeSource || !mergeTarget) return;
    const targetId = Number(mergeTarget);
    setConfirmAction(null);
    setIsMerging(true);
    try {
      const res = await apiClient.post(`/api/v1/admin/categories/${mergeSource}/merge`, {
        targetCategoryId: targetId,
      });
      if (res.success) {
        toast.success(t('categoriesMerged'));
        setMergeSource(null);
        setMergeTarget('');
        loadCategories();
      } else {
        toast.error(res.error || t('mergeError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsMerging(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error(t('enterName'));
      return;
    }
    setIsCreating(true);
    try {
      const userSlug = createForm.slug.trim();
      const payload: Record<string, unknown> = {
        name: createForm.name.trim(),
        sortOrder: createForm.sortOrder,
        isVisible: createForm.isVisible,
        description: createForm.description.trim() || null,
        seoTitle: createForm.seoTitle.trim() || null,
        seoDescription: createForm.seoDescription.trim() || null,
        nameEn: createForm.nameEn.trim() || null,
        descriptionEn: createForm.descriptionEn.trim() || null,
        seoTitleEn: createForm.seoTitleEn.trim() || null,
        seoDescriptionEn: createForm.seoDescriptionEn.trim() || null,
        coverImage: createForm.coverImage.trim() || null,
        iconPath: createForm.iconPath.trim() || null,
      };
      if (userSlug) payload.slug = userSlug;
      if (createForm.parentId) payload.parentId = Number(createForm.parentId);
      const res = await apiClient.post('/api/v1/admin/categories', payload);
      if (res.success) {
        toast.success(t('categoryCreated'));
        setShowCreate(false);
        setCreateForm(emptyCreateForm);
        loadCategories();
      } else {
        toast.error(res.error || t('createError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    setConfirmAction({ type: 'delete', id: catId, name: cat.name });
  };

  const executeDelete = async () => {
    if (!confirmAction || confirmAction.type !== 'delete' || !confirmAction.id) return;
    const catId = confirmAction.id;
    setConfirmAction(null);
    setIsDeleting(catId);
    try {
      const res = await apiClient.delete(`/api/v1/admin/categories/${catId}`);
      if (res.success) {
        toast.success(t('categoryDeleted'));
        loadCategories();
      } else {
        toast.error(res.error || t('deleteError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggle = async (cat: AdminCategory) => {
    const res = await apiClient.put(`/api/v1/admin/categories/${cat.id}`, {
      isVisible: !cat.isVisible,
    });
    if (res.success) toast.success(cat.isVisible ? t('categoryHidden') : t('categoryShown'));
    else toast.error(res.error || t('error'));
    loadCategories();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={6} columns={4} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <Button
          onClick={() => {
            if (showCreate) setCreateForm(emptyCreateForm);
            setShowCreate(!showCreate);
          }}
        >
          {showCreate ? t('cancel') : t('createCategory')}
        </Button>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">{t('newCategory')}</p>
          <div className="flex flex-wrap gap-3">
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder={t('namePh')}
              className="w-56"
            />
            <Input
              value={createForm.slug}
              onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
              placeholder={t('slugPh')}
              className="w-44"
            />
            <Input
              type="number"
              value={String(createForm.sortOrder)}
              onChange={(e) => setCreateForm({ ...createForm, sortOrder: Number(e.target.value) })}
              placeholder={t('orderPh')}
              className="w-24"
            />
            <select
              value={createForm.parentId}
              onChange={(e) => setCreateForm({ ...createForm, parentId: e.target.value })}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
              title={t('parentTitle')}
            >
              <option value="">{t('noParent')}</option>
              {rootCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={createForm.isVisible}
                onChange={(e) => setCreateForm({ ...createForm, isVisible: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              {t('active')}
            </label>
          </div>

          <div className="mt-3 rounded-md border border-[var(--color-border)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              {t('iconSection')}
            </p>
            <div className="flex items-start gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-gradient-to-br from-blue-50 to-blue-100">
                {createForm.iconPath ? (
                  <Image
                    src={createForm.iconPath}
                    alt="icon"
                    fill
                    sizes="80px"
                    className="object-contain p-2.5"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-[var(--color-text-secondary)]">
                    {t('noIcon')}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <input
                  ref={createIconInputRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCreateIconUpload(file);
                    if (createIconInputRef.current) createIconInputRef.current.value = '';
                  }}
                  className="hidden"
                  disabled={isUploadingIcon}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createIconInputRef.current?.click()}
                    isLoading={isUploadingIcon}
                  >
                    {createForm.iconPath ? t('replace') : t('upload')}
                  </Button>
                  {createForm.iconPath && (
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, iconPath: '' })}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-snug text-[var(--color-text-secondary)]">
                  {t('iconHintFormatPre')}
                  <strong>{t('iconHintFormatBold')}</strong>
                  {t('iconHintFormatPostCreate')}
                  <br />
                  {t('iconHintSizePre')}
                  <strong>{t('iconHintSizeBold')}</strong>
                  {t('iconHintSizePostCreate')}
                  <br />
                  {t('iconHintAreaCreate')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[var(--color-border)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                {t('seoContent')}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={aiProvider}
                  onChange={(e) =>
                    updateAiProvider(e.target.value as 'claude' | 'gemini' | 'rules')
                  }
                  disabled={isGeneratingAi}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
                  title={t('aiSourceTitle')}
                >
                  <option value="claude">{t('aiClaude')}</option>
                  <option value="gemini">{t('aiGemini')}</option>
                  <option value="rules">{t('aiRules')}</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateForCreate}
                  isLoading={isGeneratingAi}
                  disabled={!createForm.name.trim()}
                >
                  ✨ {t('generate')}
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{t('descLabel')}</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  placeholder={t('descPhCreate')}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Input
                    label={t('seoTitleLabel')}
                    value={createForm.seoTitle}
                    onChange={(e) => setCreateForm({ ...createForm, seoTitle: e.target.value })}
                    maxLength={70}
                  />
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {createForm.seoTitle.length}/70
                  </p>
                </div>
                <Input
                  label={t('coverLabel')}
                  value={createForm.coverImage}
                  onChange={(e) => setCreateForm({ ...createForm, coverImage: e.target.value })}
                  placeholder={t('coverPh')}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t('seoDescLabel')}</label>
                <textarea
                  value={createForm.seoDescription}
                  onChange={(e) => setCreateForm({ ...createForm, seoDescription: e.target.value })}
                  rows={2}
                  maxLength={160}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                />
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {createForm.seoDescription.length}/160
                </p>
              </div>
            </div>

            <details className="mt-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
              <summary className="cursor-pointer text-xs font-semibold">
                <span className="mr-2 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  EN
                </span>
                {t('enTranslation')}
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Input
                  label="Name (EN)"
                  value={createForm.nameEn}
                  onChange={(e) => setCreateForm({ ...createForm, nameEn: e.target.value })}
                />
                <Input
                  label="SEO Title (EN)"
                  value={createForm.seoTitleEn}
                  onChange={(e) => setCreateForm({ ...createForm, seoTitleEn: e.target.value })}
                />
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium">Description (EN)</label>
                  <textarea
                    value={createForm.descriptionEn}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, descriptionEn: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium">SEO Description (EN)</label>
                  <textarea
                    value={createForm.seoDescriptionEn}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, seoDescriptionEn: e.target.value })
                    }
                    rows={2}
                    className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
            </details>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setCreateForm(emptyCreateForm);
              }}
            >
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleCreate} isLoading={isCreating}>
              {t('createBtn')}
            </Button>
          </div>
        </div>
      )}

      {mergeSource && (
        <div className="mb-4 rounded-[var(--radius)] border border-yellow-300 bg-yellow-50 p-4">
          <p className="mb-2 text-sm font-medium">
            {t('mergeInto', { name: categories.find((c) => c.id === mergeSource)?.name ?? '' })}
          </p>
          <div className="flex gap-2">
            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">{t('selectCategory')}</option>
              {categories
                .filter((c) => c.id !== mergeSource)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <Button size="sm" onClick={handleMerge} isLoading={isMerging} disabled={!mergeTarget}>
              {t('merge')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMergeSource(null);
                setMergeTarget('');
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">{t('reorderHint')}</p>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm">
          <span className="text-[var(--color-text-secondary)]">
            {t('selectedLabel')} <strong>{selectedIds.size}</strong>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBulk('show')}
            disabled={isBulkRunning}
          >
            {t('show')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBulk('hide')}
            disabled={isBulkRunning}
          >
            {t('hide')}
          </Button>
          <select
            value={bulkParent}
            onChange={(e) => setBulkParent(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
          >
            <option value="">{t('makeRoot')}</option>
            {rootCategories.map((c) => (
              <option key={c.id} value={c.id}>
                → {c.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBulk('setParent')}
            disabled={isBulkRunning}
          >
            {t('applyParent')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => runBulk('delete')}
            disabled={isBulkRunning}
          >
            {t('delete')}
          </Button>
          <Button size="sm" variant="outline" onClick={clearSelected}>
            {t('cancel')}
          </Button>
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        {/* Single DndContext for all rows so drag-drop between root and child
            levels resolves a valid `over` target. Reorder logic in
            handleDragEnd still confines reordering to siblings; cross-level
            drops are routed through a confirm + parentId PUT. */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {rootCategories.map((cat, i) => (
              <div key={cat.id}>
                <SortableCategoryRow
                  cat={cat}
                  isEditing={editingId === cat.id}
                  editForm={editForm}
                  isSaving={isSaving}
                  parentOptions={rootCategories}
                  isSelected={selectedIds.has(cat.id)}
                  onSelectToggle={() => toggleSelected(cat.id)}
                  onEdit={() => handleEdit(cat)}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                  onEditFormChange={setEditForm}
                  onToggle={() => handleToggle(cat)}
                  onMerge={() => setMergeSource(cat.id)}
                  onDelete={() => handleDelete(cat.id)}
                  isDeleting={isDeleting === cat.id}
                  isFirst={i === 0}
                  onIconUpload={handleIconUpload}
                  isUploadingIcon={isUploadingIcon}
                  aiProvider={aiProvider}
                  onAiProviderChange={updateAiProvider}
                  isGeneratingAi={isGeneratingAi}
                  onGenerate={handleGenerateForEdit}
                />
                {childrenOf(cat.id).map((child) => (
                  <SortableCategoryRow
                    key={child.id}
                    cat={child}
                    isEditing={editingId === child.id}
                    editForm={editForm}
                    isSaving={isSaving}
                    parentOptions={rootCategories}
                    isSelected={selectedIds.has(child.id)}
                    onSelectToggle={() => toggleSelected(child.id)}
                    onEdit={() => handleEdit(child)}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                    onEditFormChange={setEditForm}
                    onToggle={() => handleToggle(child)}
                    onMerge={() => setMergeSource(child.id)}
                    onDelete={() => handleDelete(child.id)}
                    isDeleting={isDeleting === child.id}
                    isChild
                    isFirst={false}
                    onIconUpload={handleIconUpload}
                    isUploadingIcon={isUploadingIcon}
                    aiProvider={aiProvider}
                    onAiProviderChange={updateAiProvider}
                    isGeneratingAi={isGeneratingAi}
                    onGenerate={handleGenerateForEdit}
                  />
                ))}
              </div>
            ))}
          </SortableContext>
        </DndContext>
        {categories.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-[var(--color-text-secondary)]">
            <span className="text-3xl" aria-hidden="true">
              📁
            </span>
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              {t('createFirst')}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmAction?.type === 'merge'}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeMerge}
        title={t('mergeTitle')}
        message={t('mergeMsg')}
        confirmText={t('merge')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmAction?.type === 'delete'}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeDelete}
        title={t('deleteTitle')}
        message={t('deleteMsg', { name: confirmAction?.name ?? '' })}
        confirmText={t('delete')}
        variant="danger"
      />
    </div>
  );
}

function SortableCategoryRow({
  cat,
  isEditing,
  editForm,
  isSaving,
  parentOptions,
  isSelected,
  onSelectToggle,
  onEdit,
  onSave,
  onCancel,
  onEditFormChange,
  onToggle,
  onMerge,
  onDelete,
  isDeleting,
  isChild,
  isFirst,
  onIconUpload,
  isUploadingIcon,
  aiProvider,
  onAiProviderChange,
  isGeneratingAi,
  onGenerate,
}: {
  cat: AdminCategory;
  isEditing: boolean;
  editForm: CategoryEditForm;
  isSaving: boolean;
  parentOptions: AdminCategory[];
  isSelected: boolean;
  onSelectToggle: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditFormChange: (form: CategoryEditForm) => void;
  onToggle: () => void;
  onMerge: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isChild?: boolean;
  isFirst?: boolean;
  onIconUpload: (file: File) => void;
  isUploadingIcon: boolean;
  aiProvider: 'claude' | 'gemini' | 'rules';
  onAiProviderChange: (v: 'claude' | 'gemini' | 'rules') => void;
  isGeneratingAi: boolean;
  onGenerate: (catId: number) => void;
}) {
  const t = useTranslations('admin.categoriesPage');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });
  const iconInputRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 ${isChild ? 'pl-10' : ''}`}
      >
        <div className="flex flex-wrap gap-3">
          <Input
            value={editForm.name}
            onChange={(e) => onEditFormChange({ ...editForm, name: e.target.value })}
            placeholder={t('nameEditPh')}
            className="w-48"
          />
          <Input
            value={editForm.slug}
            onChange={(e) => onEditFormChange({ ...editForm, slug: e.target.value })}
            placeholder={t('slugEditPh')}
            className="w-40"
          />
          <Input
            type="number"
            value={String(editForm.sortOrder)}
            onChange={(e) => onEditFormChange({ ...editForm, sortOrder: Number(e.target.value) })}
            placeholder={t('orderPh')}
            className="w-24"
          />
          <select
            value={editForm.parentId}
            onChange={(e) => onEditFormChange({ ...editForm, parentId: e.target.value })}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            title={t('parentTitle')}
          >
            <option value="">{t('noParent')}</option>
            {parentOptions
              .filter((c) => c.id !== cat.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={editForm.isVisible}
              onChange={(e) => onEditFormChange({ ...editForm, isVisible: e.target.checked })}
              className="accent-[var(--color-primary)]"
            />
            {t('active')}
          </label>
        </div>

        <div className="mt-3 rounded-md border border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            {t('iconSection')}
          </p>
          <div className="flex items-start gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-gradient-to-br from-blue-50 to-blue-100">
              {editForm.iconPath ? (
                <Image
                  src={editForm.iconPath}
                  alt="icon"
                  fill
                  sizes="80px"
                  className="object-contain p-2.5"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[10px] text-[var(--color-text-secondary)]">
                  {t('noIcon')}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/webp,image/jpeg,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onIconUpload(file);
                  if (iconInputRef.current) iconInputRef.current.value = '';
                }}
                className="hidden"
                disabled={isUploadingIcon}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => iconInputRef.current?.click()}
                  isLoading={isUploadingIcon}
                >
                  {editForm.iconPath ? t('replace') : t('upload')}
                </Button>
                {editForm.iconPath && (
                  <button
                    type="button"
                    onClick={() => onEditFormChange({ ...editForm, iconPath: '' })}
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    {t('delete')}
                  </button>
                )}
              </div>
              <p className="text-[11px] leading-snug text-[var(--color-text-secondary)]">
                {t('iconHintFormatPre')}
                <strong>{t('iconHintFormatBold')}</strong>
                {t('iconHintFormatPostEdit')}
                <br />
                {t('iconHintSizePre')}
                <strong>{t('iconHintSizeBold')}</strong>
                {t('iconHintSizePostEdit')}
                <br />
                {t('iconHintAreaEdit')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-[var(--color-border)] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              {t('seoContent')}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={aiProvider}
                onChange={(e) =>
                  onAiProviderChange(e.target.value as 'claude' | 'gemini' | 'rules')
                }
                disabled={isGeneratingAi}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
                title={t('aiSourceTitle')}
              >
                <option value="claude">{t('aiClaude')}</option>
                <option value="gemini">{t('aiGemini')}</option>
                <option value="rules">{t('aiRules')}</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerate(cat.id)}
                isLoading={isGeneratingAi}
              >
                ✨ {t('generate')}
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">{t('descLabel')}</label>
              <textarea
                value={editForm.description}
                onChange={(e) => onEditFormChange({ ...editForm, description: e.target.value })}
                rows={4}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                placeholder={t('descPhEdit')}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Input
                  label="SEO Title"
                  value={editForm.seoTitle}
                  onChange={(e) => onEditFormChange({ ...editForm, seoTitle: e.target.value })}
                  maxLength={70}
                />
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {editForm.seoTitle.length}/70
                </p>
              </div>
              <Input
                label={t('coverLabel')}
                value={editForm.coverImage}
                onChange={(e) => onEditFormChange({ ...editForm, coverImage: e.target.value })}
                placeholder="/uploads/categories/cover.jpg"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t('seoDescLabel')}</label>
              <textarea
                value={editForm.seoDescription}
                onChange={(e) => onEditFormChange({ ...editForm, seoDescription: e.target.value })}
                rows={2}
                maxLength={160}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                {editForm.seoDescription.length}/160
              </p>
            </div>
          </div>

          <details className="mt-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
            <summary className="cursor-pointer text-xs font-semibold">
              <span className="mr-2 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                EN
              </span>
              {t('enTranslation')}
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                label="Name (EN)"
                value={editForm.nameEn}
                onChange={(e) => onEditFormChange({ ...editForm, nameEn: e.target.value })}
              />
              <Input
                label="SEO Title (EN)"
                value={editForm.seoTitleEn}
                onChange={(e) => onEditFormChange({ ...editForm, seoTitleEn: e.target.value })}
              />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium">Description (EN)</label>
                <textarea
                  value={editForm.descriptionEn}
                  onChange={(e) => onEditFormChange({ ...editForm, descriptionEn: e.target.value })}
                  rows={3}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium">SEO Description (EN)</label>
                <textarea
                  value={editForm.seoDescriptionEn}
                  onChange={(e) =>
                    onEditFormChange({ ...editForm, seoDescriptionEn: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
          </details>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={onSave} isLoading={isSaving}>
            {t('save')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between px-4 py-3 ${!isFirst ? 'border-t border-[var(--color-border)]' : ''} ${isChild ? 'pl-10' : ''}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelectToggle}
          className="accent-[var(--color-primary)]"
          aria-label={t('selectAria', { name: cat.name })}
        />
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] active:cursor-grabbing"
          aria-label={t('dragAria', { name: cat.name })}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isChild ? 'text-sm' : ''}`}>{cat.name}</span>
          <span className="text-xs text-[var(--color-text-secondary)]">/{cat.slug}</span>
          {cat._count?.products !== undefined && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                cat._count.products === 0
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
              }`}
              title={t('productsTitle', { count: cat._count.products })}
            >
              {cat._count.products}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.isVisible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
        >
          {cat.isVisible ? t('activeBadge') : t('disabledBadge')}
        </button>
        <a
          href={`/categories/${cat.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--color-text-secondary)] hover:underline"
          title={t('viewOnSiteTitle')}
        >
          ↗
        </a>
        <button onClick={onEdit} className="text-xs text-[var(--color-primary)] hover:underline">
          {t('edit')}
        </button>
        <button
          onClick={onMerge}
          className="text-xs text-[var(--color-text-secondary)] hover:underline"
        >
          {t('merge')}
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="text-xs text-[var(--color-danger)] hover:underline disabled:opacity-50"
        >
          {isDeleting ? '...' : t('delete')}
        </button>
      </div>
    </div>
  );
}
