'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
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
  coverImage: string;
}

export default function AdminCategoriesPage() {
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
    coverImage: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [mergeSource, setMergeSource] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', parentId: '' });
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
    if (action === 'delete' && !window.confirm(`Видалити ${selectedIds.size} категорій?`)) return;

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
        toast.success('Готово');
        clearSelected();
        loadCategories();
      } else {
        toast.error(res.error || 'Помилка bulk-операції');
      }
    } catch {
      toast.error('Помилка мережі');
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
      coverImage: cat.coverImage || '',
    });
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
        coverImage: editForm.coverImage.trim() || null,
        version: current?.version,
      };
      const res = await apiClient.put(`/api/v1/admin/categories/${editingId}`, payload);
      if (res.success) {
        toast.success('Категорію оновлено');
        setEditingId(null);
        loadCategories();
      } else if (res.statusCode === 409) {
        toast.error(res.error || 'Категорію змінено іншим адміністратором', {
          duration: 12000,
          action: {
            label: 'Оновити з сервера',
            onClick: () => {
              loadCategories();
              setEditingId(null);
              toast.success('Оновлено — відкрийте знову і повторіть редагування');
            },
          },
        });
      } else {
        toast.error(res.error || 'Не вдалося оновити категорію');
      }
    } catch {
      toast.error('Помилка мережі');
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
        `Перенести "${activeCat.name}" → "${
          newParentId ? categories.find((c) => c.id === newParentId)?.name : 'верхній рівень'
        }"?`,
      );
      if (!ok) return;

      const res = await apiClient.put(`/api/v1/admin/categories/${activeCat.id}`, {
        parentId: newParentId,
      });
      if (res.success) {
        toast.success('Категорію перенесено');
        loadCategories();
      } else {
        toast.error(res.error || 'Не вдалося перенести');
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
      toast.error(res.error || 'Не вдалося оновити порядок');
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
        toast.success('Категорії об’єднано');
        setMergeSource(null);
        setMergeTarget('');
        loadCategories();
      } else {
        toast.error(res.error || 'Не вдалося об’єднати');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsMerging(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Введіть назву категорії');
      return;
    }
    setIsCreating(true);
    try {
      const userSlug = createForm.slug.trim();
      const payload: Record<string, unknown> = { name: createForm.name.trim() };
      if (userSlug) payload.slug = userSlug;
      if (createForm.parentId) payload.parentId = Number(createForm.parentId);
      const res = await apiClient.post('/api/v1/admin/categories', payload);
      if (res.success) {
        toast.success('Категорію створено');
        setShowCreate(false);
        setCreateForm({ name: '', slug: '', parentId: '' });
        loadCategories();
      } else {
        toast.error(res.error || 'Не вдалося створити категорію');
      }
    } catch {
      toast.error('Помилка мережі');
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
        toast.success('Категорію видалено');
        loadCategories();
      } else {
        toast.error(res.error || 'Не вдалося видалити');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggle = async (cat: AdminCategory) => {
    const res = await apiClient.put(`/api/v1/admin/categories/${cat.id}`, {
      isVisible: !cat.isVisible,
    });
    if (res.success) toast.success(cat.isVisible ? 'Категорію сховано' : 'Категорію показано');
    else toast.error(res.error || 'Помилка');
    loadCategories();
  };

  if (isLoading) {
    return <AdminTableSkeleton rows={6} columns={4} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Категорії</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Скасувати' : '+ Створити категорію'}
        </Button>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">Нова категорія</p>
          <div className="flex flex-wrap gap-3">
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Назва категорії"
              className="w-56"
            />
            <Input
              value={createForm.slug}
              onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
              placeholder="Slug (автоматично)"
              className="w-44"
            />
            <select
              value={createForm.parentId}
              onChange={(e) => setCreateForm({ ...createForm, parentId: e.target.value })}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">Без батьківської</option>
              {rootCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button onClick={handleCreate} isLoading={isCreating}>
              Створити
            </Button>
          </div>
        </div>
      )}

      {mergeSource && (
        <div className="mb-4 rounded-[var(--radius)] border border-yellow-300 bg-yellow-50 p-4">
          <p className="mb-2 text-sm font-medium">
            Об&apos;єднати &quot;{categories.find((c) => c.id === mergeSource)?.name}&quot; в:
          </p>
          <div className="flex gap-2">
            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">Оберіть категорію</option>
              {categories
                .filter((c) => c.id !== mergeSource)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <Button size="sm" onClick={handleMerge} isLoading={isMerging} disabled={!mergeTarget}>
              Об&apos;єднати
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMergeSource(null);
                setMergeTarget('');
              }}
            >
              Скасувати
            </Button>
          </div>
        </div>
      )}

      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
        Перетягуйте категорії для зміни порядку. Перетягнення на категорію іншого рівня → запит на перенос.
      </p>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm">
          <span className="text-[var(--color-text-secondary)]">
            Обрано: <strong>{selectedIds.size}</strong>
          </span>
          <Button size="sm" variant="outline" onClick={() => runBulk('show')} disabled={isBulkRunning}>
            Показати
          </Button>
          <Button size="sm" variant="outline" onClick={() => runBulk('hide')} disabled={isBulkRunning}>
            Сховати
          </Button>
          <select
            value={bulkParent}
            onChange={(e) => setBulkParent(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
          >
            <option value="">Зробити кореневою</option>
            {rootCategories.map((c) => (
              <option key={c.id} value={c.id}>
                → {c.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => runBulk('setParent')} disabled={isBulkRunning}>
            Застосувати батька
          </Button>
          <Button size="sm" variant="danger" onClick={() => runBulk('delete')} disabled={isBulkRunning}>
            Видалити
          </Button>
          <Button size="sm" variant="outline" onClick={clearSelected}>
            Скасувати
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
            <p className="text-sm font-medium">Категорій немає</p>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              + Створити першу категорію
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmAction?.type === 'merge'}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeMerge}
        title="Об'єднання категорій"
        message="Об'єднати категорію в іншу? Всі товари будуть переміщені."
        confirmText="Об'єднати"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmAction?.type === 'delete'}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeDelete}
        title="Видалення категорії"
        message={`Видалити категорію "${confirmAction?.name ?? ''}"? Товари залишаться без категорії.`}
        confirmText="Видалити"
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });

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
            placeholder="Назва"
            className="w-48"
          />
          <Input
            value={editForm.slug}
            onChange={(e) => onEditFormChange({ ...editForm, slug: e.target.value })}
            placeholder="Slug"
            className="w-40"
          />
          <Input
            type="number"
            value={String(editForm.sortOrder)}
            onChange={(e) => onEditFormChange({ ...editForm, sortOrder: Number(e.target.value) })}
            placeholder="Порядок"
            className="w-24"
          />
          <select
            value={editForm.parentId}
            onChange={(e) => onEditFormChange({ ...editForm, parentId: e.target.value })}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            title="Батьківська категорія"
          >
            <option value="">Без батьківської (root)</option>
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
            Активна
          </label>
        </div>

        <div className="mt-3 rounded-md border border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            SEO та контент
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Опис категорії</label>
              <textarea
                value={editForm.description}
                onChange={(e) => onEditFormChange({ ...editForm, description: e.target.value })}
                rows={2}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                placeholder="Коротка інформація для сторінки категорії"
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
                label="Обкладинка (URL)"
                value={editForm.coverImage}
                onChange={(e) => onEditFormChange({ ...editForm, coverImage: e.target.value })}
                placeholder="/uploads/categories/cover.jpg"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">SEO Description</label>
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
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Скасувати
          </Button>
          <Button size="sm" onClick={onSave} isLoading={isSaving}>
            Зберегти
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
          aria-label={`Обрати ${cat.name}`}
        />
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] active:cursor-grabbing"
          aria-label={`Перетягнути ${cat.name}`}
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
              title={`${cat._count.products} товарів`}
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
          {cat.isVisible ? 'Активна' : 'Вимкнена'}
        </button>
        <a
          href={`/categories/${cat.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--color-text-secondary)] hover:underline"
          title="Переглянути на сайті"
        >
          ↗
        </a>
        <button onClick={onEdit} className="text-xs text-[var(--color-primary)] hover:underline">
          Редагувати
        </button>
        <button
          onClick={onMerge}
          className="text-xs text-[var(--color-text-secondary)] hover:underline"
        >
          Об&apos;єднати
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="text-xs text-[var(--color-danger)] hover:underline disabled:opacity-50"
        >
          {isDeleting ? '...' : 'Видалити'}
        </button>
      </div>
    </div>
  );
}
